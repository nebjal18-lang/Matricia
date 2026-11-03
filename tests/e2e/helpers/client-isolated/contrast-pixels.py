"""Rendered contrast bounds and opaque glyph checks; axe ratio zero stays unknown."""
import json
import math
import re
import sys
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(sys.argv[1]).resolve()
if 'work/client-browser-isolated' not in str(root) or root.name != 'accessibility':
    raise ValueError('OWNED_REVIEW_DIRECTORY_REQUIRED')
proof = json.loads((root / 'contrast-review.json').read_text())

def luminance(rgb):
    rgb = rgb / 255
    values = np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4)
    return values @ np.array([.2126, .7152, .0722])

def contrast(first, second):
    return (np.maximum(first, second) + .05) / (np.minimum(first, second) + .05)

for scan in proof['scans']:
    background = np.array(Image.open(root / scan['backgroundScreenshot']).convert('RGB'))
    normal = np.array(Image.open(root / scan['screenshot']).convert('RGB'))
    if background.shape != normal.shape:
        raise ValueError('MATCHING_SCREENSHOTS_REQUIRED')
    height, width, _ = background.shape
    for node in scan['nodes']:
        color = [float(value) for value in re.findall(r'[\d.]+', node['color'])]
        if len(color) not in (3, 4):
            raise ValueError('EXACT_SRGB_COLOR_REQUIRED')
        alpha = color[3] if len(color) == 4 else 1
        for ancestor in node['ancestors']:
            alpha *= float(ancestor['opacity'])
        minimum, core_minimum = math.inf, math.inf
        lowest_background, core_location = None, None
        samples = clipped_samples = occluded_samples = core_samples = 0
        inside_menu = any('client-account' in str(a['class']).split() for a in node['ancestors'])
        for rect in node['rects']:
            x0, y0 = max(0, math.ceil(rect['x'])), max(0, math.ceil(rect['y']))
            x1, y1 = min(width, math.floor(rect['x'] + rect['width'])), min(height, math.floor(rect['y'] + rect['height']))
            if x0 >= x1 or y0 >= y1:
                continue
            yy, xx = np.mgrid[y0:y1, x0:x1]
            visible = np.ones(xx.shape, dtype=bool)
            for clip in node['clipAncestors']:
                if clip['clipX']:
                    visible &= (xx >= clip['x']) & (xx < clip['x'] + clip['width'])
                if clip['clipY']:
                    visible &= (yy >= clip['y']) & (yy < clip['y'] + clip['height'])
            clipped_samples += int((~visible).sum())
            occlusion = node['occlusion']
            if occlusion and not inside_menu:
                covered = ((xx >= occlusion['x']) & (xx < occlusion['x'] + occlusion['width']) & (yy >= occlusion['y']) & (yy < occlusion['y'] + occlusion['height']))
                occluded_samples += int((covered & visible).sum())
                visible &= ~covered
            if not visible.any():
                continue
            backdrop = background[y0:y1, x0:x1].astype(float)
            actual = normal[y0:y1, x0:x1].astype(float)
            rendered = alpha * np.array(color[:3]) + (1 - alpha) * backdrop
            backdrop_luminance = luminance(backdrop)
            ratios = contrast(luminance(rendered), backdrop_luminance)
            samples += int(visible.sum())
            local_minimum = float(ratios[visible].min())
            if local_minimum < minimum:
                minimum = local_minimum
                index = np.argwhere(visible & (ratios == local_minimum))[0]
                lowest_background = backdrop[tuple(index)].astype(int).tolist()
            core = visible & (np.max(np.abs(actual - rendered), axis=-1) <= 2) & (np.max(np.abs(actual - backdrop), axis=-1) > 15)
            core_samples += int(core.sum())
            if core.any():
                core_ratios = contrast(luminance(actual), backdrop_luminance)
                local_core = float(core_ratios[core].min())
                if local_core < core_minimum:
                    core_minimum = local_core
                    row, column = np.argwhere(core & (core_ratios == local_core))[0]
                    core_location = {'x': int(x0 + column), 'y': int(y0 + row), 'foregroundRgb': actual[row, column].astype(int).tolist(), 'backgroundRgb': backdrop[row, column].astype(int).tolist()}
        font_size = float(node['fontSize'].replace('px', ''))
        weight = 700 if node['fontWeight'] == 'bold' else 400 if node['fontWeight'] == 'normal' else float(node['fontWeight'])
        threshold = 3 if font_size >= 24 or (font_size >= 18.66 and weight >= 700) else 4.5
        filtered = any(a['filter'] != 'none' or a['mixBlendMode'] != 'normal' or a['clipPath'] != 'none' for a in node['ancestors'])
        node['renderedBackgroundBound'] = {'samples': samples, 'clippedSamplesNotMeasured': clipped_samples, 'occludedSamplesNotMeasured': occluded_samples, 'nontrivialFilterOrBlendOrClipPath': filtered, 'minimumRatio': round(minimum, 4) if samples else None, 'lowestBackgroundRgb': lowest_background, 'requiredRatio': threshold, 'meetsConservativeBound': minimum >= threshold if samples and not filtered else False, 'method': 'all visible rendered background pixels in text ranges after text fill removal; ancestor opacity multiplied; clipping and open-menu occlusion excluded; filters/blends/clip-path require separate review'}
        node['opaqueGlyphMeasurement'] = {'coreSamples': core_samples, 'minimumRatio': round(core_minimum, 4) if core_samples else None, 'minimumLocation': core_location, 'method': 'normal screenshot pixels matching composited foreground within two RGB levels and differing from background by more than 15; antialias edge pixels excluded'}
        if node['ariaHidden']:
            node['reviewDisposition'] = 'DECORATIVE_BRAND_MARK_LOGOTYPE_CONTRAST_EXCEPTION'
        elif not samples:
            node['reviewDisposition'] = 'NOT_MEASURED_CLIPPED_OR_NOT_RENDERED'
        elif samples and minimum >= threshold and not filtered and not clipped_samples and not occluded_samples:
            node['reviewDisposition'] = 'RENDERED_BACKGROUND_BOUND_MEETS_TEXT_CONTRAST'
        elif core_samples and core_minimum < threshold and not filtered:
            node['reviewDisposition'] = 'OPAQUE_GLYPH_CONTRAST_BELOW_THRESHOLD_REVIEW'
        elif (minimum >= threshold or (core_samples and core_minimum >= threshold)) and not filtered and (clipped_samples or occluded_samples):
            node['reviewDisposition'] = 'VISIBLE_PORTION_MEETS_CONTRAST_CLIPPED_OR_OCCLUDED_PORTION_NOT_MEASURED'
        elif core_samples and core_minimum >= threshold and not filtered:
            node['reviewDisposition'] = 'OPAQUE_GLYPHS_MEET_CONTRAST_BACKGROUND_RECT_EXTENDS_BEYOND_TEXT_BACKING'
        else:
            node['reviewDisposition'] = 'NEEDS_VISUAL_REVIEW_OF_BOUND_AND_OCCLUSION'
proof['reviewCounts'] = {}
for scan in proof['scans']:
    for node in scan['nodes']:
        key = node['reviewDisposition']
        proof['reviewCounts'][key] = proof['reviewCounts'].get(key, 0) + 1
(root / 'contrast-measured.json').write_text(json.dumps(proof, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'scans': len(proof['scans']), 'counts': proof['reviewCounts']}))

/** Blocking bootstrap so AR/FR first paint matches the URL without dynamicizing the root layout. */
export const DOCUMENT_LOCALE_BOOTSTRAP = `(function(){try{var m=location.pathname.match(/^\\/(fr|ar)(?=\\/|$)/);if(!m)return;var l=m[1];document.documentElement.lang=l;document.documentElement.dir=l==="ar"?"rtl":"ltr";}catch(_){}})();`;

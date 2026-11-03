/** Valid, deterministic one-page PDF containing synthetic fixture identity text. */
export function localFixturePdf(lines){
 const escape=value=>String(value).normalize('NFKD').replace(/[^\x20-\x7e]/gu,'').replace(/[\\()]/gu,'\\$&');
 const stream=`BT /F1 11 Tf 14 TL 45 795 Td ${lines.map(line=>`(${escape(line)}) Tj T*`).join(' ')} ET\n`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let text='%PDF-1.4\n';const offsets=[0];
 for(const [index,object]of objects.entries()){offsets.push(Buffer.byteLength(text));text+=`${index+1} 0 obj\n${object}\nendobj\n`;}
 const xref=Buffer.byteLength(text);
 text+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Buffer.from(text,'ascii');
}

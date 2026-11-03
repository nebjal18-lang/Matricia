import {renderToStaticMarkup} from "react-dom/server";
import {afterEach,describe,expect,it,vi} from "vitest";
import Page from "./page";
afterEach(()=>vi.restoreAllMocks());
for(const locale of ["fr","ar"] as const)describe(`public session recovery ${locale}`,()=>{
 it("offers the requested page again without calling Auth or claiming the session was lost",async()=>{
  vi.spyOn(console,"error").mockImplementation(()=>undefined);
  const path=`/${locale}/franchise/services?organizationId=test&franchiseId=approved`;
  const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale}),searchParams:Promise.resolve({next:path})}));
  expect(html).toContain(`dir="${locale==="ar"?"rtl":"ltr"}"`);expect(html).toContain('data-workspace-failure="UNAVAILABLE"');expect(html).toContain(path.replaceAll('&','&amp;'));expect(html).not.toContain(`/${locale}/connexion`);
 });
 it("never uses an external or other-language retry destination",async()=>{
  vi.spyOn(console,"error").mockImplementation(()=>undefined);
  for(const next of ['https://external.invalid/','//external.invalid/',`/${locale==="fr"?"ar":"fr"}/administration`]){
   const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale}),searchParams:Promise.resolve({next})}));
   expect(html).not.toContain('external.invalid');expect(html).toContain(`href="/${locale}/"`);
  }
 });
});

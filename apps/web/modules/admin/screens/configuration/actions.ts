"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import type {ConfigurationActionState} from "@/modules/shared/lib/platform-configuration/model";
import {configurationFailure,saveConfigurationForm,testConfigurationForm,decideConfigurationForm,deactivateConfigurationForm} from "@/modules/shared/lib/platform-configuration/repository";

export async function managePlatformConfiguration(_:ConfigurationActionState,form:FormData):Promise<ConfigurationActionState>{
  let locale:"fr"|"ar"|undefined;
  try{
    locale=z.enum(["fr","ar"]).parse(form.get("locale"));
    const intent=z.enum(["save","test","approve","reject","disable"]).parse(form.get("intent"));
    let probeCode:string|undefined;
    let outcome:string;
    if(intent==="save")outcome=(await saveConfigurationForm(form)).outcome;
    else if(intent==="test"){const result=await testConfigurationForm(form);outcome=result.outcome;probeCode=result.probeCode;}
    else if(intent==="disable")outcome=(await deactivateConfigurationForm(form)).outcome;
    else outcome=(await decideConfigurationForm(form,intent==="approve")).outcome;
    revalidatePath(`/${locale}/administration/configuration`);
    revalidatePath(`/${locale}/administration/operations`);
    return {status:"success",reason:outcome,...(probeCode?{probeCode}:{})};
  }catch(error){if(locale)revalidatePath(`/${locale}/administration/configuration`);return {status:"error",reason:configurationFailure(error)};}
}

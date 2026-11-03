/** Local manifests are accepted only under the explicit Docker-verified runner. */
export function validFixtureProject(value){
 if(process.env.E2E_LOCAL_ISOLATED==='1')return value.environment==='development'&&value.projectRef===`local-${process.env.E2E_LOCAL_PROJECT_ID}`&&/^[A-Za-z][A-Za-z0-9_-]{2,63}$/u.test(process.env.E2E_LOCAL_PROJECT_ID??'')&&value.proof?.runtimeMode==='isolated-local-docker'&&value.proof?.authentication==='REAL_GOTRUE_OTP_AND_TOTP';
 return ['development','staging'].includes(value.environment)&&typeof value.projectRef==='string'&&/^[a-z0-9]{10,40}$/u.test(value.projectRef);
}

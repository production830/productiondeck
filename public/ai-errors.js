// Error reports contain no photo pixels, URLs, query strings or session credentials.
export function describeAIError(error,stage='loading'){
 const raw=String(error?.message||error||'Unknown error');
 let code='ai_'+stage,message='AI could not finish. Open the error details below so we can identify the cause. Manual tagging still works.';
 if(/out of memory|memory access out of bounds|allocation failed|array buffer allocation/i.test(raw)){
  code='ai_memory';message='The AI ran out of browser memory. Close other heavy tabs and retry with one photo. Manual tagging still works.';
 }else if(/cache|quota|storage.*(denied|full|exceed)/i.test(raw)){
  code='ai_cache';message='The browser could not store or read the AI model. Retry outside private browsing, or free some browser storage. Manual tagging still works.';
 }else if(/failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module/i.test(raw)){
  code='ai_runtime_download';message='The AI software could not load from Productiondeck. Refresh the site and retry; if it continues, share the error details below. Manual tagging still works.';
 }else if(/no available backend|webassembly|wasm|compileerror|instantiate|unsupported.*(operator|kernel)|inferencesession/i.test(raw)){
  code='ai_engine';message='The browser could not start the AI engine. Open the error details below; a recent Chrome or Edge browser may help. Manual tagging still works.';
 }else if(stage==='analyzing'&&/decode|bitmap|image.*(read|load|invalid)|unsupported input type/i.test(raw)){
  code='ai_photo';message='The AI could not read a photo. Try one JPEG or PNG photo first. Your original photos and tags have been kept.';
 }else if(/failed to fetch|network|fetch failed|load failed|could not locate file|unauthorized|forbidden|\b(401|403|404|429|502|503)\b/i.test(raw)){
  code='ai_model_download';message='The AI model download failed. Your network or a browser extension may be blocking Hugging Face. Open the error details below. Manual tagging still works.';
 }
 const detail=raw.replace(/https?:\/\/[^\s"'<>]+/gi,'[download URL]').replace(/Bearer\s+\S+/gi,'[redacted]').replace(/[\r\n\t]+/g,' ').slice(0,320);
 return {code,message,detail,stage};
}

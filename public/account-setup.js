(()=>{
 const form=document.querySelector('#account-setup-form'),error=document.querySelector('#account-setup-error'),status=document.querySelector('#account-setup-status');
 let tokenHash=new URLSearchParams(location.hash.slice(1)).get('token')||'';
 history.replaceState(null,'',location.pathname);
 if(!tokenHash){error.textContent='Open the complete private link from your administrator. If it was already used, ask for a new link.';form.querySelector('button').disabled=true}
 document.querySelector('#setup-show-password').onchange=event=>{for(const key of ['password','repeat'])form.elements[key].type=event.target.checked?'text':'password'};
 form.onsubmit=async event=>{event.preventDefault();error.textContent='';if(form.elements.password.value!==form.elements.repeat.value){error.textContent='The two passwords do not match.';return}const button=form.querySelector('button');button.disabled=true;status.textContent='Setting up your account…';
  try{const response=await fetch('/api/account-setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tokenHash,password:form.elements.password.value})});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not complete setup.');tokenHash='';form.reset();status.textContent='Password saved. Opening your library…';location.replace('/#browse')}
  catch(problem){error.textContent=problem.message;status.textContent='';button.disabled=false}
 };
})();

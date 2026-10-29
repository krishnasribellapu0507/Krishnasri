const menu=document.querySelector('.menu-toggle');
const nav=document.querySelector('#primary-nav');
menu?.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');});
nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu?.setAttribute('aria-expanded','false');menu?.setAttribute('aria-label','Open navigation');}));
const copy=document.querySelector('#copy-note');
copy?.addEventListener('click',async()=>{const note='Hi Krishnasri, I saw your portfolio and would love to connect about your projects.';const status=document.querySelector('.copy-status');try{await navigator.clipboard.writeText(note);status.textContent='Hello note copied. Paste it into your preferred message app.';}catch{status.textContent=note;}});
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const hero=document.querySelector('.hero-image');let raf=0;
addEventListener('pointermove',e=>{if(reduce.matches||innerWidth<800||raf)return;raf=requestAnimationFrame(()=>{const x=(e.clientX/innerWidth-.5)*-5,y=(e.clientY/innerHeight-.5)*-4;hero.style.objectPosition=`calc(50% + ${x}px) calc(55% + ${y}px)`;raf=0;});},{passive:true});

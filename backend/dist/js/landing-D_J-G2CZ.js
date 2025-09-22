import"./modulepreload-polyfill-B5Qt9EMX.js";document.addEventListener("DOMContentLoaded",()=>{const n=document.querySelector(".btn-outline-light"),a=document.querySelector(".cta-button");function r(){const o=document.getElementById("particles");if(o)for(let e=0;e<30;e++){const t=document.createElement("div");t.className="particle burst",t.style.left="50%",t.style.top="50%";const i=Math.random()*2*Math.PI,l=60+Math.random()*60,d=Math.cos(i)*l,m=Math.sin(i)*l;t.style.setProperty("--x",`${d}px`),t.style.setProperty("--y",`${m}px`),t.style.setProperty("--dur",`${.6+Math.random()*.4}s`),o.appendChild(t),setTimeout(()=>t.remove(),1e3)}setTimeout(()=>{window.location.href="/home"},1e3)}n==null||n.addEventListener("click",r),a==null||a.addEventListener("click",r);const s=document.getElementById("particles");if(s)for(let e=0;e<50;e++){const t=document.createElement("div");t.className="particle",t.style.left=Math.random()*100+"%",t.style.top=Math.random()*100+"%",t.style.animationDelay=Math.random()*6+"s",t.style.animationDuration=Math.random()*3+3+"s",s.appendChild(t)}const c=document.createElement("style");c.textContent=`
        .particle.burst {
            position: absolute;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #3b82f6;
            pointer-events: none;
            transform: translate(-50%, -50%);
            animation: burstAnim var(--dur, 0.8s) forwards;
        }

        @keyframes burstAnim {
            0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            100% { opacity: 0; transform: translate(calc(-50% + var(--x)), calc(-50% + var(--y))) scale(0.2); }
        }
    `,document.head.appendChild(c)});

(function(){const f=document.createElement("link").relList;if(f&&f.supports&&f.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))g(e);new MutationObserver(e=>{for(const o of e)if(o.type==="childList")for(const t of o.addedNodes)t.tagName==="LINK"&&t.rel==="modulepreload"&&g(t)}).observe(document,{childList:!0,subtree:!0});function d(e){const o={};return e.integrity&&(o.integrity=e.integrity),e.referrerPolicy&&(o.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?o.credentials="include":e.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function g(e){if(e.ep)return;e.ep=!0;const o=d(e);fetch(e.href,o)}})();const P="modulepreload",T=function(y){return"/"+y},z={},k=function(f,d,g){let e=Promise.resolve();if(d&&d.length>0){document.getElementsByTagName("link");const t=document.querySelector("meta[property=csp-nonce]"),a=(t==null?void 0:t.nonce)||(t==null?void 0:t.getAttribute("nonce"));e=Promise.allSettled(d.map(l=>{if(l=T(l),l in z)return;z[l]=!0;const i=l.endsWith(".css"),r=i?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${l}"]${r}`))return;const s=document.createElement("link");if(s.rel=i?"stylesheet":P,i||(s.as="script"),s.crossOrigin="",s.href=l,a&&s.setAttribute("nonce",a),document.head.appendChild(s),i)return new Promise((v,_)=>{s.addEventListener("load",v),s.addEventListener("error",()=>_(new Error(`Unable to preload CSS for ${l}`)))})}))}function o(t){const a=new Event("vite:preloadError",{cancelable:!0});if(a.payload=t,window.dispatchEvent(a),!a.defaultPrevented)throw t}return e.then(t=>{for(const a of t||[])a.status==="rejected"&&o(a.reason);return f().catch(o)})};function O({footprint:y,datasetId:f}){return new Promise(async d=>{let g,e=[],o=0,t=0,a=0;const l=30,i=`
            <div class="modal-overlay">
                <dialog class="modal-card">
                    <div class="modal-content">
                        <div class="text-center">
                            <h2 class="modal-title">Configure Analysis Area</h2>
                            <p class="modal-subtitle">
                                You have selected:
                                <strong class="modal-footprint-title">${y.title}</strong>
                            </p>
                        </div>
                        <div id="status-message-container"></div>
                        <div class="modal-section" id="zoom-controls-container"></div>
                        <div class="modal-info-box" id="size-info-container"></div>
                        <div class="modal-footer">
                            <button id="cancel-btn" class="btn btn-secondary">
                                Cancel
                            </button>
                            <button id="confirm-btn" class="btn btn-cta">
                                <i class="fas fa-download me-2"></i>
                                Confirm & Download
                            </button>
                        </div>
                    </div>
                </dialog>
            </div>
        `,r=document.createElement("div");r.innerHTML=i,document.body.appendChild(r),g=r.querySelector("dialog");const s=r.querySelector("#status-message-container"),v=r.querySelector("#zoom-controls-container"),_=r.querySelector("#size-info-container"),w=r.querySelector("#confirm-btn"),$=r.querySelector("#cancel-btn");let L={mb:0,count:0},h=[];async function x(){const m=y.title.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");try{const c=await fetch(`http://localhost:8000/ingest/status/${f}/${m}`);c.ok&&(h=(await c.json()).existingZooms||[])}catch(c){console.error("Could not fetch status:",c),h=[]}}function M(m,c,b){let n=0;if(!m)return{count:0,mb:0};for(const u of e)u>=b&&u<=c&&(n+=m[u].count);return{count:n,mb:n*l/1024}}function S(){L=M(y.downloadInfo.tilesPerZoom,a,o),h.length>0&&(s.innerHTML=`
                    <div class="status-badge status-success">
                        <div class="status-text">
                            Already downloaded zooms: ${Math.min(...h)}-${Math.max(...h)}
                        </div>
                    </div>
                `),o>t?(v.innerHTML=`
                    <div class="text-center font-semibold text-gray-light">
                        ✅ All available zooms have already been downloaded!
                    </div>
                `,w.disabled=!0):(v.innerHTML=`
                    <label for="zoom-slider" class="modal-label">
                        Select Max Zoom to Download (${o}-${t})
                    </label>
                    <p class="modal-hint">
                        Higher zoom means more detail but larger download size.
                    </p>
                    <input
                        type="range"
                        id="zoom-slider"
                        min="${o}"
                        max="${t}"
                        value="${a}"
                        class="modal-slider"
                    />
                    <div class="modal-slider-labels">
                        <span>Zoom ${o}</span>
                        <span>Zoom ${t}</span>
                    </div>
                `,w.disabled=!1,r.querySelector("#zoom-slider").addEventListener("input",c=>{a=c.target.value,S()})),_.innerHTML=`
                <p class="modal-info-text">
                    Estimated Download (up to Zoom ${a}):
                    <span class="modal-info-value">${L.mb.toFixed(2)} MB</span>
                </p>
                <p class="modal-info-hint">Total tiles: ${L.count}</p>
            `}if(await x(),e=Object.keys(y.downloadInfo.tilesPerZoom).map(Number).sort((m,c)=>m-c),e.length>0){const m=h.length?Math.max(...h):-1;o=Math.max(e[0],m+1),t=e[e.length-1],a=t}S(),g.showModal(),$.addEventListener("click",()=>{g.close(),d(null)}),w.addEventListener("click",()=>{g.close(),d({minZoom:o,maxZoom:a})}),g.addEventListener("close",()=>{document.body.removeChild(r)})})}document.addEventListener("DOMContentLoaded",()=>{const f=new URLSearchParams(window.location.search).get("datasetId");let d=null;const e={mars_viking_vis:{id:"mars_viking_vis",name:"Mars: Viking VIS Global Color Mosaic",tileUrl:"https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0//default/default028mm/{z}/{y}/{x}.jpg",maxZoom:7},venus_magellan_gt:{id:"venus_magellan_gt",name:"Venus: Magellan Global Topography",tileUrl:"https://trek.nasa.gov/tiles/Venus/EQ/Venus_Magellan_C3-MDIR_Global_Mosaic_2025m/1.0.0/default/default028mm/{z}/{y}/{x}.png",maxZoom:7},mercury_messenger_mds:{id:"mercury_messenger_mds",name:"Mercury: MESSENGER Global Mosaic",tileUrl:"https://trek.nasa.gov/tiles/Mercury/EQ/Mercury_MESSENGER_MDIS_Basemap_BDR_Mosaic_Global_166m/1.0.0//default/default028mm/{z}/{y}/{x}.jpg",maxZoom:8}}[f]||null,o=document.getElementById("loading-overlay"),t=document.getElementById("status-message"),a=document.querySelector(".panel-content");if(!e){document.getElementById("map-container").innerHTML=`
            <div class="empty-state-container">
                <div class="empty-state-card">
                    <h2 class="empty-state-title">No Project Selected</h2>
                    <p class="empty-state-text">
                        Go to the <a href="/home" class="empty-state-link">Home Dashboard</a> to start a project.
                    </p>
                </div>
            </div>`;return}let l,i,r,s=null;async function v(){i=(await k(async()=>{const{default:u}=await import("./leaflet-src-BllHigrc.js").then(p=>p.l);return{default:u}},[])).default;const n=i.icon({iconUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",iconSize:[25,41],iconAnchor:[12,41],shadowUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"});i.Marker.prototype.options.icon=n,l=i.map("map-container",{crs:i.CRS.EPSG4326,center:[0,0],zoom:1,maxZoom:e.maxZoom,zoomControl:!1}),i.tileLayer(e.tileUrl,{maxZoom:e.maxZoom,noWrap:!0,attribution:e.name}).addTo(l),r=new i.FeatureGroup().addTo(l),await _(),await h()}async function _(){x("Loading footprints...");try{const n=await fetch(`/${f}_footprints.json`);if(!n.ok)throw new Error("Failed to load footprints");const u=await n.json();r.clearLayers(),u.forEach(p=>{const[E,C,I,Z]=p.bbox;i.rectangle([[C,E],[Z,I]],{color:"white",weight:.7,fillOpacity:.1}).addTo(r).on("click",()=>{s=p,w()})}),r.getLayers().length>0&&l.fitBounds(r.getBounds(),{padding:[50,50]})}catch(n){console.error(n),alert("Failed to load footprints")}finally{M()}}function w(){O({footprint:s,datasetId:e.id}).then(n=>{n&&$(n)})}function $(n){if(!s){console.error("No footprint selected!");return}const u={footprintId:s.title.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,""),datasetId:e.id,tileUrl:s.tileUrl,tilesPerZoom:s.downloadInfo.tilesPerZoom,minZoom:n.minZoom,maxZoom:n.maxZoom};L(u)}async function L(n){x("Sending request to backend..."),d=new AbortController;const{signal:u}=d;try{const E=await(await fetch("http://localhost:8000/ingest",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(n),signal:u})).json();t.textContent=`✅ Success! New data for '${E.dataset_id}' is ready.`}catch(p){p.name==="AbortError"?t.textContent="Ingestion canceled by user.":(console.error(p),t.textContent=`Error: ${p.message}`)}finally{setTimeout(M,3e3),d=null}}async function h(){o.classList.remove("hidden"),t.textContent="Loading analysis areas...";try{const n=await fetch(`http://localhost:8000/datasets/${f}/footprints`);if(!n.ok)throw a.innerHTML='<p class="status-text">Failed to load analysis areas.</p>',new Error("Failed to fetch analysis areas from API");const p=(await n.json()).footprints||[];if(p.length===0)a.innerHTML='<p class="status-text">No downloaded areas found for this dataset.</p>';else{const E=p.map(C=>{const I=C.replace(/_/g," "),Z=`/analysis?dataset=${f}&footprint=${C.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"")}`;return`
                        <li class="list-item">
                            <span class="footprint-name">${I}</span>
                            <a href="${Z}" class="open-button">Open</a>
                        </li>
                    `}).join("");a.innerHTML=`<ul class="footprint-list">${E}</ul>`}}catch(n){console.error("Error loading downloads panel:",n),t.textContent="Failed to load analysis areas."}finally{o.classList.add("hidden")}}function x(n){o&&t&&(o.style.display="flex",t.textContent=n)}function M(){o&&(o.style.display="none")}v();const S=document.querySelector(".sidebar-container"),m=document.querySelector(".toggle-btn");let c=!0;m==null||m.addEventListener("click",()=>{c=!c,S.classList.toggle("collapsed",!c),m.textContent=c?"⏴":"⏵"});const b=document.getElementById("cancel-ingestion");b==null||b.addEventListener("click",()=>{if(!d||(d.abort(),!s))return;const n={datasetId:e.id,footprintId:s.title.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"")};fetch("http://localhost:8000/ingest/cancel",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(n)}).catch(u=>console.error("Failed to send cancel signal:",u))})});

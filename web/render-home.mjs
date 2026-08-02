export function renderHome(value, archetype) {
  const site = value.site ?? {};
  const sections = value.collections?.page?.find((page) => page.type === "home")?.sections ?? [];
  const hasForms = sections.some((section) => section.fields?.length);
  return `<!doctype html>
<html lang="${html(value.locale ?? "en")}">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="mantle:site" content="v1"><meta name="mantle:archetype" content="${html(archetype)}">
  <title>${html(site.brand ?? "Mantle")}</title>
  <meta name="description" content="${html(site.description ?? "")}">
  <style>${styles}</style>
</head>
<body>
  <header><a class="brand" href="/">${html(site.brand ?? "Mantle")}</a><nav>${links(site.navLinks)}${link(site.navAction, "button")}</nav></header>
  <main>${sections.map((section, index) => renderSection(section, archetype, index)).join("")}</main>
  <footer><strong>${html(site.brand ?? "Mantle")}</strong><p>${html(site.footer?.tagline ?? "")}</p><small>${html(site.footer?.copyright ?? "")}</small></footer>
  ${hasForms ? `<script type="module">${formScript}</script>` : ""}
</body>
</html>`;
}

function renderSection(section, archetype, index) {
  const items = section.items ?? [];
  const actions = section.fields?.length
    ? link(section.secondaryAction)
    : `${link(section.action, "button")}${link(section.secondaryAction)}`;
  const body = section.body ? `<p>${html(section.body)}</p>` : "";
  const cards = items.length
    ? `<div class="grid">${items.map((item) => {
        const title = item.title ?? item.name ?? item.value;
        const body = item.body ?? item.quote;
        return `<article>${title ? `<h3>${html(title)}</h3>` : ""}${body ? `<p>${html(body)}</p>` : ""}${link(item)}</article>`;
      }).join("")}</div>`
    : "";
  const form = section.fields?.length
    ? `<form action="${html(section.action?.href ?? "")}">${section.fields.map(renderField).join("")}${usesTurnstile(archetype) ? '<div class="cf-turnstile" data-sitekey="{{TURNSTILE_SITE_KEY}}"></div>' : ""}<button type="submit">${html(section.action?.label ?? "Submit")}</button><output aria-live="polite"></output></form>`
    : "";
  const heading = index === 0 ? "h1" : "h2";
  return `<section${section.id ? ` id="${html(section.id)}"` : ""} class="${html(section.type ?? "section")}">
    ${section.eyebrow ? `<small>${html(section.eyebrow)}</small>` : ""}
    <${heading}>${html(section.title ?? "")}</${heading}>${body}<div class="actions">${actions}</div>${cards}${form}
  </section>`;
}

function renderField(field) {
  const name = field.name ?? "field";
  const common = `name="${html(name)}"${field.placeholder ? ` placeholder="${html(field.placeholder)}"` : ""}${field.autocomplete ? ` autocomplete="${html(field.autocomplete)}"` : ""}${field.required ? " required" : ""}`;
  const control = field.options?.length
    ? `<select ${common}><option value="">Select…</option>${field.options.map((option) => `<option value="${html(option.value)}">${html(option.label)}</option>`).join("")}</select>`
    : field.multiline
    ? `<textarea ${common}></textarea>`
    : `<input type="${html(field.type ?? "text")}" ${common}${field.type === "number" ? ' min="1" step="1" data-number' : ""}>`;
  return `<label>${html(field.label ?? name)}${control}</label>`;
}

function usesTurnstile(archetype) {
  return archetype === "presence" || archetype === "intake";
}

function links(values) {
  return (values ?? []).map((value) => link(value)).join("");
}

function link(value, className = "") {
  if (!value?.href || !value.label) return "";
  return `<a${className ? ` class="${className}"` : ""} href="${html(value.href)}">${html(value.label)}</a>`;
}

function html(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

const formScript = `document.querySelectorAll(".cf-turnstile").forEach(widget=>{if(!widget.dataset.sitekey)widget.remove()});if(document.querySelector(".cf-turnstile")){const script=document.createElement("script");script.src="https://challenges.cloudflare.com/turnstile/v0/api.js";script.async=true;script.defer=true;document.head.append(script)}document.querySelectorAll("form[action]").forEach(form=>form.addEventListener("submit",async event=>{event.preventDefault();const output=form.querySelector("output");const submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=true;if(output)output.value="Sending…";try{const data=Object.fromEntries(new FormData(form));form.querySelectorAll("[data-number]").forEach(input=>{if(input.value)data[input.name]=Number(input.value);else delete data[input.name]});const response=await fetch(form.action,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});if(!response.ok)throw new Error("Request failed");form.reset();if(output)output.value="Sent."}catch{if(output)output.value="Please try again."}finally{if(submit)submit.disabled=false;const widget=form.querySelector(".cf-turnstile");if(widget&&globalThis.turnstile?.reset)globalThis.turnstile.reset()}}));`;

const styles = `:root{color-scheme:light dark;font-family:ui-sans-serif,system-ui;line-height:1.5;background:#fafafa;color:#171717}*{box-sizing:border-box}body{margin:0}header,main,footer{width:min(70rem,calc(100% - 2rem));margin:auto}header{min-height:4.5rem;display:flex;align-items:center;justify-content:space-between;gap:1rem}nav,.actions{display:flex;align-items:center;gap:1rem;flex-wrap:wrap}a{color:inherit}.brand{text-decoration:none;font-weight:750}.button,button{display:inline-block;border:0;border-radius:.6rem;padding:.7rem 1rem;background:#171717;color:#fff;text-decoration:none;font:inherit}section{padding:clamp(3rem,8vw,7rem) 0;border-top:1px solid #ddd}section:first-child{border:0}h1,h2{max-width:18ch;font-size:clamp(2rem,6vw,4.5rem);line-height:1.05;margin:.5rem 0 1rem}section>p{max-width:44rem;font-size:1.1rem;color:#555}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));gap:1rem;margin-top:2rem}article,form{padding:1.25rem;border:1px solid #ddd;border-radius:1rem;background:#fff}label{display:grid;gap:.35rem;margin-bottom:1rem}input,select,textarea{font:inherit;padding:.7rem;border:1px solid #bbb;border-radius:.5rem;background:transparent}textarea{min-height:8rem}output{display:block;margin-top:1rem}footer{padding:3rem 0 5rem}@media(prefers-color-scheme:dark){:root{background:#111;color:#eee}section,article,form,input,select,textarea{border-color:#333}article,form{background:#181818}section>p{color:#bbb}.button,button{background:#eee;color:#111}}`;

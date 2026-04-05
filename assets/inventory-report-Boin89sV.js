import{w as O,p as e,v as w,a as g}from"./chunk-UVKPFVEO-B2WGzElT.js";import{u as P}from"./shop-context-BDiY6n4d.js";function G({}){return[{title:"Inventory Report"},{name:"description",content:"Shopify inventory report"}]}const E=`mutation {
  bulkOperationRunQuery(
    query: """
    {
      products {
        edges {
          node {
            id
            title
            metafields(first: 1, keys: ["custom.associated_manufacturer"]) {
              edges {
                node {
                  key
                  value
                  reference {
                    ... on Metaobject {
                      fields {
                        key
                        value
                      }
                    }
                  }
                }
              }
            }
            variants {
              edges {
                node {
                  id
                  title
                  sku
                  metafields(first: 1, keys: ["custom.reorder_point"]) {
                    edges {
                      node {
                        key
                        value
                      }
                    }
                  }
                  inventoryItem {
                    id
                    tracked
                    inventoryLevels {
                      edges {
                        node {
                          location {
                            name
                          }
                          quantities(names: ["available", "on_hand", "committed"]) {
                            name
                            quantity
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    """
  ) {
    bulkOperation {
      id
      status
    }
    userErrors {
      field
      message
    }
  }
}`,C=`query {
  currentBulkOperation {
    id
    status
    url
  }
}`,I="https://throbbing-frog-a6d8.kalob-taulien.workers.dev/graphql";async function L(a,n,o){return(await fetch(I,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({shop:a,access_token:n,query:o})})).json()}function _(a){return new Promise(n=>setTimeout(n,a))}function U(a){const n=a.trim().split(`
`).map(t=>JSON.parse(t)),o=new Map,i=new Map;for(const t of n){const p=t.id,d=t.__parentId;if(p?.includes("/Product/")&&!d)o.set(p,{title:t.title,manufacturer:null,variants:[]});else if(p?.includes("/ProductVariant/")&&d){const l={title:t.title,sku:t.sku,reorderPoint:null,inventoryLevels:[]};i.set(p,l),o.get(d)?.variants.push(l)}else if(t.key==="custom.associated_manufacturer"&&d){const l=t.reference?.fields?.find(u=>u.key==="name")?.value??null,c=o.get(d);c&&(c.manufacturer=l)}else if(t.key==="custom.reorder_point"&&d){const l=i.get(d);l&&(l.reorderPoint=Number(t.value))}else if(t.location&&d){const l=i.get(d);if(l){const c=t.quantities.reduce((u,s)=>(u[s.name]=s.quantity,u),{});l.inventoryLevels.push({location:t.location.name,available:c.available??0,onHand:c.on_hand??0,committed:c.committed??0})}}}return Array.from(o.values())}function A(){const{session:a}=P(),[n,o]=g.useState([]),[i,t]=g.useState(!1),[p,d]=g.useState(!1),[l,c]=g.useState(""),[u,s]=g.useState(null),r=g.useRef(!1),f=g.useCallback(async()=>{if(a){r.current=!1,t(!0),s(null);try{c("Starting bulk operation...");const m=await L(a.shop,a.accessToken,E),x=m.data?.bulkOperationRunQuery?.bulkOperation,y=m.data?.bulkOperationRunQuery?.userErrors;if(y?.length)throw new Error(y.map(j=>j.message).join(", "));if(!x?.id)throw new Error("Failed to start bulk operation");const M=x.id;let k=5e3;const S=2e4;let v=null,N=0;for(;!r.current;){N++;const j=k/1e3;c(`Still processing... checking again in ${j}s (attempt ${N})`),await _(k),k=Math.min(k+5e3,S);const h=(await L(a.shop,a.accessToken,C)).data?.currentBulkOperation;if(h){if(h.status==="COMPLETED"){v=h.url;break}else if(h.status==="FAILED"||h.status==="CANCELED")throw new Error(`Bulk operation ${h.status.toLowerCase()}`)}}if(!v)throw new Error("Bulk operation completed but no URL returned");c("Downloading inventory data...");const R=await(await fetch(v)).text();o(U(R)),d(!0)}catch(m){s(m instanceof Error?m.message:String(m))}finally{t(!1),c("")}}},[a]);return{productGroups:n,loading:i,loaded:p,status:l,error:u,loadInventory:f}}function b(a){if(a==null)return"";const n=String(a);return n.includes(",")||n.includes('"')||n.includes(`
`)||n.includes("\r")?`"${n.replace(/"/g,'""')}"`:n}function B(a){const n=[["Product","Variant","SKU","Pref. Vendor","Location","Available","On Hand","Reorder Point","On Sales Order"].join(",")];for(const o of a)for(const i of o.variants)for(const t of i.inventoryLevels){const p=[b(o.title),b(i.title),b(i.sku),b(o.manufacturer),b(t.location),t.available,t.onHand,i.reorderPoint??"",t.committed].join(",");n.push(p)}return n.join(`
`)}function T(a){const n=B(a),o=new Blob([n],{type:"text/csv;charset=utf-8;"}),i=URL.createObjectURL(o),t=document.createElement("a");t.href=i,t.download="inventory-report.csv",document.body.appendChild(t),t.click(),document.body.removeChild(t),URL.revokeObjectURL(i)}const Q=O(function(){const{productGroups:n,loading:o,loaded:i,status:t,error:p,loadInventory:d}=A(),l=["Variant","SKU","Pref. Vendor","Location","Available","On Hand","Reorder Point","On Sales Order"],c=["15%","12%","12%","16%","10%","10%","12%","13%"],u=()=>e.jsx("colgroup",{children:c.map((s,r)=>e.jsx("col",{style:{width:s}},r))});return!i&&!o?e.jsxs("div",{className:"min-h-screen bg-white dark:bg-gray-950 p-8",children:[e.jsxs("div",{className:"flex items-center gap-4 mb-6",children:[e.jsx(w,{to:"/",className:"text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors",children:"← Back"}),e.jsx("h1",{className:"text-3xl font-bold text-gray-900 dark:text-white",children:"Inventory Report"})]}),p&&e.jsx("div",{className:"rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4 mb-4",children:e.jsx("p",{className:"text-sm text-red-700 dark:text-red-400",children:p})}),e.jsx("button",{onClick:d,className:"px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors",children:"Load Inventory Report"})]}):o?e.jsxs("div",{className:"min-h-screen bg-white dark:bg-gray-950 p-8",children:[e.jsxs("div",{className:"flex items-center gap-4 mb-6",children:[e.jsx(w,{to:"/",className:"text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors",children:"← Back"}),e.jsx("h1",{className:"text-3xl font-bold text-gray-900 dark:text-white",children:"Inventory Report"})]}),e.jsx("p",{className:"text-gray-500 dark:text-gray-400",children:"Loading entire inventory... this may take a minute or two."}),t&&e.jsx("p",{className:"text-sm text-gray-400 dark:text-gray-500 mt-2",children:t})]}):e.jsxs("div",{className:"min-h-screen bg-white dark:bg-gray-950 p-8 print:p-0 print:ml-1.5",children:[e.jsxs("div",{className:"flex items-center justify-between mb-6 print:mb-2",children:[e.jsxs("div",{className:"flex items-center gap-4",children:[e.jsx(w,{to:"/",className:"text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors print:hidden",children:"← Back"}),e.jsx("h1",{className:"text-3xl font-bold text-gray-900 dark:text-white print:text-base",children:"Inventory Report"})]}),e.jsx("button",{onClick:()=>T(n),className:"px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors print:hidden",children:"Download CSV"})]}),e.jsx("div",{className:"hidden print:block",children:e.jsxs("table",{className:"w-full print:table-fixed",children:[e.jsx(u,{}),e.jsx("thead",{children:e.jsx("tr",{children:l.map(s=>e.jsx("th",{className:"text-left text-xs font-semibold uppercase tracking-wider py-1 px-1 print:text-base print:font-bold",children:s},s))})})]})}),e.jsx("div",{className:"space-y-6 print:space-y-0",children:n.map(s=>e.jsxs("div",{className:"rounded-lg border border-gray-200 dark:border-gray-700 print:rounded-none print:border-0",children:[e.jsxs("div",{className:"sticky top-0 z-10",children:[e.jsxs("div",{className:"bg-gray-100 dark:bg-gray-800 px-4 py-3 flex items-baseline gap-3 print:bg-transparent print:px-1 print:py-1 rounded-t-lg border-b border-gray-200 dark:border-gray-700 print:rounded-none print:border-0",children:[e.jsx("h2",{className:"text-lg font-semibold text-gray-900 dark:text-white print:text-base print:font-bold",children:s.title}),s.manufacturer&&e.jsxs("span",{className:"text-sm text-gray-500 dark:text-gray-400 print:hidden",children:["Manufacturer: ",s.manufacturer]})]}),e.jsxs("table",{className:"min-w-full print:hidden",children:[e.jsx(u,{}),e.jsx("thead",{className:"bg-gray-50 dark:bg-gray-800/50",children:e.jsx("tr",{children:l.map(r=>e.jsx("th",{className:"px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider",children:r},r))})})]})]}),e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{className:"min-w-full divide-y divide-gray-200 dark:divide-gray-700 print:divide-y-0 print:table-fixed",children:[e.jsx(u,{}),e.jsx("thead",{className:"bg-gray-50 dark:bg-gray-800/50 print:hidden",children:e.jsx("tr",{className:"sr-only",children:l.map(r=>e.jsx("th",{children:r},r))})}),e.jsx("tbody",{className:"divide-y divide-gray-200 dark:divide-gray-700 print:divide-y-0",children:s.variants.map(r=>{const f=r.inventoryLevels.find(x=>x.location==="US Shop"),m=r.reorderPoint!==null&&f!==void 0&&f.available<r.reorderPoint;return r.inventoryLevels.map((x,y)=>e.jsxs("tr",{className:m?"bg-yellow-100 dark:bg-yellow-900/30 print:bg-transparent":"hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",children:[y===0?e.jsx("td",{rowSpan:r.inventoryLevels.length,className:"px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium align-top print:px-1 print:py-0.5",children:r.title}):null,y===0?e.jsx("td",{rowSpan:r.inventoryLevels.length,className:"px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono align-top print:px-1 print:py-0.5",children:r.sku}):null,y===0?e.jsx("td",{rowSpan:r.inventoryLevels.length,className:"px-4 py-3 text-sm text-gray-700 dark:text-gray-300 align-top print:px-1 print:py-0.5",children:s.manufacturer??""}):null,e.jsx("td",{className:"px-4 py-3 text-sm text-gray-700 dark:text-gray-300 print:px-1 print:py-0.5",children:x.location}),e.jsx("td",{className:"px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100 print:px-1 print:py-0.5",children:x.available.toLocaleString()}),e.jsx("td",{className:"px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100 print:px-1 print:py-0.5",children:x.onHand.toLocaleString()}),y===0?e.jsx("td",{rowSpan:r.inventoryLevels.length,className:"px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100 align-middle print:px-1 print:py-0.5",children:r.reorderPoint?.toLocaleString()??""}):null,e.jsx("td",{className:"px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100 print:px-1 print:py-0.5",children:x.committed.toLocaleString()})]},`${r.sku}-${x.location}`))})})]})})]},s.title))}),e.jsxs("p",{className:"mt-6 text-sm text-gray-500 dark:text-gray-400 print:hidden",children:[n.reduce((s,r)=>s+r.variants.length,0)," variants across"," ",n.length," products"]})]})});export{Q as default,G as meta};

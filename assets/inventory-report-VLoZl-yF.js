import{w as L,p as t,v as k,a as g}from"./chunk-UVKPFVEO-B2WGzElT.js";import{u as R}from"./shop-context-BDiY6n4d.js";function H({}){return[{title:"Inventory Report"},{name:"description",content:"Shopify inventory report"}]}const S=`mutation {
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
}`,O=`query {
  currentBulkOperation {
    id
    status
    url
  }
}`,P="https://throbbing-frog-a6d8.kalob-taulien.workers.dev/graphql";async function w(n,r,o){return(await fetch(P,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({shop:n,access_token:r,query:o})})).json()}function E(n){return new Promise(r=>setTimeout(r,n))}function C(n){const r=n.trim().split(`
`).map(e=>JSON.parse(e)),o=new Map,i=new Map;for(const e of r){const p=e.id,c=e.__parentId;if(p?.includes("/Product/")&&!c)o.set(p,{title:e.title,manufacturer:null,variants:[]});else if(p?.includes("/ProductVariant/")&&c){const l={title:e.title,sku:e.sku,reorderPoint:null,inventoryLevels:[]};i.set(p,l),o.get(c)?.variants.push(l)}else if(e.key==="custom.associated_manufacturer"&&c){const l=e.reference?.fields?.find(x=>x.key==="name")?.value??null,d=o.get(c);d&&(d.manufacturer=l)}else if(e.key==="custom.reorder_point"&&c){const l=i.get(c);l&&(l.reorderPoint=Number(e.value))}else if(e.location&&c){const l=i.get(c);if(l){const d=e.quantities.reduce((x,s)=>(x[s.name]=s.quantity,x),{});l.inventoryLevels.push({location:e.location.name,available:d.available??0,onHand:d.on_hand??0,committed:d.committed??0})}}}return Array.from(o.values())}function I(){const{session:n}=R(),[r,o]=g.useState([]),[i,e]=g.useState(!1),[p,c]=g.useState(!1),[l,d]=g.useState(""),[x,s]=g.useState(null),a=g.useRef(!1),m=g.useCallback(async()=>{if(n){a.current=!1,e(!0),s(null);try{d("Starting bulk operation...");const u=await w(n.shop,n.accessToken,S),f=u.data?.bulkOperationRunQuery?.bulkOperation,v=u.data?.bulkOperationRunQuery?.userErrors;if(v?.length)throw new Error(v.map(j=>j.message).join(", "));if(!f?.id)throw new Error("Failed to start bulk operation");const B=f.id;d("Waiting for Shopify to process bulk data...");let b=null;for(;!a.current;){await E(15e3);const y=(await w(n.shop,n.accessToken,O)).data?.currentBulkOperation;if(!y){d("Waiting for Shopify to process bulk data... (polling again in 15s)");continue}if(y.status==="COMPLETED"){b=y.url;break}else if(y.status==="FAILED"||y.status==="CANCELED")throw new Error(`Bulk operation ${y.status.toLowerCase()}`);d(`Waiting for Shopify to process bulk data... (status: ${y.status})`)}if(!b)throw new Error("Bulk operation completed but no URL returned");d("Downloading inventory data...");const N=await(await fetch(b)).text();o(C(N)),c(!0)}catch(u){s(u instanceof Error?u.message:String(u))}finally{e(!1),d("")}}},[n]);return{productGroups:r,loading:i,loaded:p,status:l,error:x,loadInventory:m}}function h(n){if(n==null)return"";const r=String(n);return r.includes(",")||r.includes('"')||r.includes(`
`)||r.includes("\r")?`"${r.replace(/"/g,'""')}"`:r}function _(n){const r=[["Product","Variant","SKU","Pref. Vendor","Location","Available","On Hand","Reorder Point","On Sales Order"].join(",")];for(const o of n)for(const i of o.variants)for(const e of i.inventoryLevels){const p=[h(o.title),h(i.title),h(i.sku),h(o.manufacturer),h(e.location),e.available,e.onHand,i.reorderPoint??"",e.committed].join(",");r.push(p)}return r.join(`
`)}function U(n){const r=_(n),o=new Blob([r],{type:"text/csv;charset=utf-8;"}),i=URL.createObjectURL(o),e=document.createElement("a");e.href=i,e.download="inventory-report.csv",document.body.appendChild(e),e.click(),document.body.removeChild(e),URL.revokeObjectURL(i)}const V=L(function(){const{productGroups:r,loading:o,loaded:i,status:e,error:p,loadInventory:c}=I(),l=["Variant","SKU","Pref. Vendor","Location","Available","On Hand","Reorder Point","On Sales Order"],d=["15%","12%","12%","16%","10%","10%","12%","13%"],x=()=>t.jsx("colgroup",{children:d.map((s,a)=>t.jsx("col",{style:{width:s}},a))});return!i&&!o?t.jsxs("div",{className:"min-h-screen bg-white dark:bg-gray-950 p-8",children:[t.jsxs("div",{className:"flex items-center gap-4 mb-6",children:[t.jsx(k,{to:"/",className:"text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors",children:"← Back"}),t.jsx("h1",{className:"text-3xl font-bold text-gray-900 dark:text-white",children:"Inventory Report"})]}),p&&t.jsx("div",{className:"rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4 mb-4",children:t.jsx("p",{className:"text-sm text-red-700 dark:text-red-400",children:p})}),t.jsx("button",{onClick:c,className:"px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors",children:"Load Inventory Report"})]}):o?t.jsxs("div",{className:"min-h-screen bg-white dark:bg-gray-950 p-8",children:[t.jsxs("div",{className:"flex items-center gap-4 mb-6",children:[t.jsx(k,{to:"/",className:"text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors",children:"← Back"}),t.jsx("h1",{className:"text-3xl font-bold text-gray-900 dark:text-white",children:"Inventory Report"})]}),t.jsx("p",{className:"text-gray-500 dark:text-gray-400",children:"Loading entire inventory... this may take a minute or two."}),e&&t.jsx("p",{className:"text-sm text-gray-400 dark:text-gray-500 mt-2",children:e})]}):t.jsxs("div",{className:"min-h-screen bg-white dark:bg-gray-950 p-8 print:p-0 print:ml-1.5",children:[t.jsxs("div",{className:"flex items-center justify-between mb-6 print:mb-2",children:[t.jsxs("div",{className:"flex items-center gap-4",children:[t.jsx(k,{to:"/",className:"text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors print:hidden",children:"← Back"}),t.jsx("h1",{className:"text-3xl font-bold text-gray-900 dark:text-white print:text-base",children:"Inventory Report"})]}),t.jsx("button",{onClick:()=>U(r),className:"px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors print:hidden",children:"Download CSV"})]}),t.jsx("div",{className:"hidden print:block",children:t.jsxs("table",{className:"w-full print:table-fixed",children:[t.jsx(x,{}),t.jsx("thead",{children:t.jsx("tr",{children:l.map(s=>t.jsx("th",{className:"text-left text-xs font-semibold uppercase tracking-wider py-1 px-1 print:text-base print:font-bold",children:s},s))})})]})}),t.jsx("div",{className:"space-y-6 print:space-y-0",children:r.map(s=>t.jsxs("div",{className:"rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden print:rounded-none print:border-0",children:[t.jsxs("div",{className:"bg-gray-100 dark:bg-gray-800 px-4 py-3 flex items-baseline gap-3 print:bg-transparent print:px-1 print:py-1",children:[t.jsx("h2",{className:"text-lg font-semibold text-gray-900 dark:text-white print:text-base print:font-bold",children:s.title}),s.manufacturer&&t.jsxs("span",{className:"text-sm text-gray-500 dark:text-gray-400 print:hidden",children:["Manufacturer: ",s.manufacturer]})]}),t.jsx("div",{className:"overflow-x-auto",children:t.jsxs("table",{className:"min-w-full divide-y divide-gray-200 dark:divide-gray-700 print:divide-y-0 print:table-fixed",children:[t.jsx(x,{}),t.jsx("thead",{className:"bg-gray-50 dark:bg-gray-800/50 print:hidden",children:t.jsx("tr",{children:l.map(a=>t.jsx("th",{className:"px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider",children:a},a))})}),t.jsx("tbody",{className:"divide-y divide-gray-200 dark:divide-gray-700 print:divide-y-0",children:s.variants.map(a=>a.inventoryLevels.map((m,u)=>{const f=a.reorderPoint!==null&&m.available<a.reorderPoint;return t.jsxs("tr",{className:f?"bg-yellow-100 dark:bg-yellow-900/30 print:bg-transparent":"hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",children:[u===0?t.jsx("td",{rowSpan:a.inventoryLevels.length,className:"px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium align-top print:px-1 print:py-0.5",children:a.title}):null,u===0?t.jsx("td",{rowSpan:a.inventoryLevels.length,className:"px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono align-top print:px-1 print:py-0.5",children:a.sku}):null,u===0?t.jsx("td",{rowSpan:a.inventoryLevels.length,className:"px-4 py-3 text-sm text-gray-700 dark:text-gray-300 align-top print:px-1 print:py-0.5",children:s.manufacturer??""}):null,t.jsx("td",{className:"px-4 py-3 text-sm text-gray-700 dark:text-gray-300 print:px-1 print:py-0.5",children:m.location}),t.jsx("td",{className:"px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100 print:px-1 print:py-0.5",children:m.available.toLocaleString()}),t.jsx("td",{className:"px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100 print:px-1 print:py-0.5",children:m.onHand.toLocaleString()}),u===0?t.jsx("td",{rowSpan:a.inventoryLevels.length,className:"px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100 align-middle print:px-1 print:py-0.5",children:a.reorderPoint?.toLocaleString()??""}):null,t.jsx("td",{className:"px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100 print:px-1 print:py-0.5",children:m.committed.toLocaleString()})]},`${a.sku}-${m.location}`)}))})]})})]},s.title))}),t.jsxs("p",{className:"mt-6 text-sm text-gray-500 dark:text-gray-400 print:hidden",children:[r.reduce((s,a)=>s+a.variants.length,0)," variants across"," ",r.length," products"]})]})});export{V as default,H as meta};

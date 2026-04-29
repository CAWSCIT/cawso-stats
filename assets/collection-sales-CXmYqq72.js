import{a as c,p as t}from"./chunk-UVKPFVEO-BpGGSgSy.js";import{u as et}from"./shop-context-wHUHkOVG.js";const J="https://cawso-stats.dal04.workers.dev/graphql",rt=100,p="gid://shopify/Collection/";function st(e){return e.startsWith(p)?e:`${p}${e}`}function dt(e){return e.startsWith(p)?e.slice(p.length):e}function ot(e){return`query getCollectionProducts {
    collection(id: "${e}") {
      id
      title
      handle
      products(first: 250) {
        nodes {
          id
          title
        }
      }
    }
  }`}function at(e){return`query getOrdersPage {
    orders(first: 200, sortKey: CREATED_AT, reverse: true${e?`, after: "${e}"`:""}) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        name
        lineItems(first: 200) {
          nodes {
            quantity
            originalTotalSet {
              shopMoney {
                amount
              }
            }
            discountedTotalSet {
              shopMoney {
                amount
              }
            }
            discountAllocations {
              allocatedAmountSet {
                shopMoney {
                  amount
                }
              }
            }
            product {
              id
            }
          }
        }
      }
    }
  }`}function Q(e){if(!e||typeof e!="object")return null;const r=e;return Array.isArray(r.errors)?r.errors.length===0?null:r.errors.map(s=>typeof s=="string"?s:s&&typeof s=="object"&&"message"in s?String(s.message):JSON.stringify(s)).join(", "):typeof r.errors=="string"?r.errors:r.errors&&typeof r.errors=="object"?JSON.stringify(r.errors):typeof r.error=="string"?r.error:r.error&&typeof r.error=="object"?JSON.stringify(r.error):null}function a(e){return e.toLocaleString("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2})}const m=new Map;function ct(e){const r=st(e),{session:s}=et(),[l,o]=c.useState(m.get(r)??null),[F,T]=c.useState(!1),[G,C]=c.useState({pages:0,orders:0}),[W,A]=c.useState(null),E=c.useRef(null),h=c.useCallback(async()=>{if(s){T(!0),A(null),C({pages:0,orders:0});try{const M=await(await fetch(J,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({shop:s.shop,access_token:s.accessToken,query:ot(r)})})).json(),q=Q(M);if(q)throw new Error(q);const f=M.data?.collection;if(!f)throw new Error("Collection not found");const X=f.title??"Collection",b=f.products?.nodes??[],H=new Set(b.map(n=>n.id)),U=new Map(b.map(n=>[n.id,n.title])),k=new Map;let D=0,R=0,I=0,N=0,L=0,j=null,S=!0,w=0;for(;S&&w<rt;){w+=1;const x=await(await fetch(J,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({shop:s.shop,access_token:s.accessToken,query:at(j)})})).json(),$=Q(x);if($)throw new Error($);const P=x.data?.orders,K=P?.nodes??[];for(const V of K){N+=1;let _=!1;for(const i of V.lineItems.nodes){const d=i.product?.id;if(!d||!H.has(d))continue;_=!0;const g=Number(i.originalTotalSet.shopMoney.amount)||0,Y=Number(i.discountedTotalSet.shopMoney.amount)||0,z=i.discountAllocations.reduce((Z,tt)=>Z+(Number(tt.allocatedAmountSet.shopMoney.amount)||0),0),v=g-Y+z;D+=i.quantity,R+=g,I+=v;const y=k.get(d);y?(y.quantity+=i.quantity,y.amount+=g,y.discount+=v):k.set(d,{id:d,title:U.get(d)??d,quantity:i.quantity,amount:g,discount:v})}_&&(L+=1)}C({pages:w,orders:N}),S=P?.pageInfo?.hasNextPage??!1,j=P?.pageInfo?.endCursor??null,j||(S=!1)}const B=Array.from(k.values()).sort((n,x)=>x.amount-n.amount),O={collectionId:r,collectionTitle:X,totalQuantity:D,totalAmount:R,totalDiscount:I,ordersScanned:N,ordersWithMatch:L,perProduct:B,collectionProducts:b};m.set(r,O),o(O)}catch(u){A(u instanceof Error?u.message:String(u))}finally{T(!1)}}},[s,r]);return c.useEffect(()=>{o(m.get(r)??null),s&&!m.has(r)&&E.current!==r&&(E.current=r,h())},[s,r,h]),{totals:l,loading:F,progress:G,error:W,reload:h}}function lt({totals:e,loading:r,progress:s,error:l}){return t.jsxs(t.Fragment,{children:[l&&t.jsx("div",{className:"rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4 mb-6",children:t.jsx("p",{className:"text-sm text-red-700 dark:text-red-400",children:l})}),r&&!e&&t.jsxs("p",{className:"text-sm text-gray-500 dark:text-gray-400",children:["Scanning orders... (",s.orders," orders across ",s.pages," ",s.pages===1?"page":"pages",")"]}),e&&t.jsxs(t.Fragment,{children:[r&&t.jsxs("p",{className:"text-sm text-gray-500 dark:text-gray-400 mb-4",children:["Refreshing... (",s.orders," orders / ",s.pages," pages)"]}),t.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8",children:[t.jsxs("div",{className:"rounded-lg border border-gray-200 dark:border-gray-700 p-5",children:[t.jsx("p",{className:"text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400",children:"Total dollar value sold"}),t.jsx("p",{className:"mt-2 text-3xl font-bold text-gray-900 dark:text-white",children:a(e.totalAmount)})]}),t.jsxs("div",{className:"rounded-lg border border-gray-200 dark:border-gray-700 p-5",children:[t.jsx("p",{className:"text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400",children:"Total quantity sold"}),t.jsx("p",{className:"mt-2 text-3xl font-bold text-gray-900 dark:text-white",children:e.totalQuantity.toLocaleString()})]}),t.jsxs("div",{className:"rounded-lg border border-gray-200 dark:border-gray-700 p-5",children:[t.jsx("p",{className:"text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400",children:"Total discounted (loss)"}),t.jsx("p",{className:"mt-2 text-3xl font-bold text-red-600 dark:text-red-400",children:a(e.totalDiscount)})]})]}),t.jsxs("p",{className:"text-sm text-gray-600 dark:text-gray-400 mb-6",children:["Scanned ",e.ordersScanned.toLocaleString()," orders;"," ",e.ordersWithMatch.toLocaleString()," contained an item from this collection. Collection has"," ",e.collectionProducts.length," products."]}),e.perProduct.length>0?t.jsx("div",{className:"rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden",children:t.jsxs("table",{className:"min-w-full divide-y divide-gray-200 dark:divide-gray-700",children:[t.jsx("thead",{className:"bg-gray-50 dark:bg-gray-800/50",children:t.jsxs("tr",{children:[t.jsx("th",{className:"px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider",children:"Product"}),t.jsx("th",{className:"px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider",children:"Quantity"}),t.jsx("th",{className:"px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider",children:"Amount"}),t.jsx("th",{className:"px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider",children:"Discounted (loss)"})]})}),t.jsx("tbody",{className:"divide-y divide-gray-200 dark:divide-gray-700",children:e.perProduct.map(o=>t.jsxs("tr",{className:"hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",children:[t.jsx("td",{className:"px-4 py-2 text-sm text-gray-900 dark:text-gray-100",children:o.title}),t.jsx("td",{className:"px-4 py-2 text-sm text-right tabular-nums text-gray-700 dark:text-gray-300",children:o.quantity.toLocaleString()}),t.jsx("td",{className:"px-4 py-2 text-sm text-right tabular-nums text-gray-700 dark:text-gray-300",children:a(o.amount)}),t.jsx("td",{className:`px-4 py-2 text-sm text-right tabular-nums ${o.discount>0?"text-red-600 dark:text-red-400":"text-gray-500 dark:text-gray-500"}`,children:o.discount>0?`-${a(o.discount)}`:a(0)})]},o.id))}),t.jsx("tfoot",{className:"bg-gray-50 dark:bg-gray-800/50",children:t.jsxs("tr",{children:[t.jsx("td",{className:"px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100",children:"Total"}),t.jsx("td",{className:"px-4 py-2 text-sm font-semibold text-right tabular-nums text-gray-900 dark:text-gray-100",children:e.totalQuantity.toLocaleString()}),t.jsx("td",{className:"px-4 py-2 text-sm font-semibold text-right tabular-nums text-gray-900 dark:text-gray-100",children:a(e.totalAmount)}),t.jsx("td",{className:`px-4 py-2 text-sm font-semibold text-right tabular-nums ${e.totalDiscount>0?"text-red-600 dark:text-red-400":"text-gray-900 dark:text-gray-100"}`,children:e.totalDiscount>0?`-${a(e.totalDiscount)}`:a(0)})]})})]})}):t.jsxs("p",{className:"text-sm text-gray-500 dark:text-gray-400",children:["No orders contained any product from this collection (in the last"," ",e.ordersScanned.toLocaleString()," orders scanned)."]})]})]})}export{lt as C,J as G,dt as c,Q as e,ct as u};

var fs=require("fs"); 
var t=fs.readFileSync("src/app/free-agents/page.tsx","utf8"); 
t=t.replace("    .sort((a: any, b: any) => {\n      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0\n      return sortDir === 'desc' ? bv - av : av - bv\n    })","    .sort((a: any, b: any) => {\n      if (sortKey === 'glTeam') { const r = (a.glTeam||'').localeCompare(b.glTeam||''); return sortDir === 'asc' ? r : -r }\n      if (sortKey === 'name')  { const r = a.name?.localeCompare(b.name)||0; return sortDir === 'asc' ? r : -r }\n      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0\n      return sortDir === 'desc' ? bv - av : av - bv\n    })"); 
fs.writeFileSync("src/app/free-agents/page.tsx",t,"utf8"); 
console.log("done:"+t.includes("a.glTeam")); 

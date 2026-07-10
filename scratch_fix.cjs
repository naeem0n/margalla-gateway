const fs = require('fs');
let content = fs.readFileSync('E:/Margalla Gateaway/Margalla Gateaway/server/src/routes/queryBridge.ts', 'utf8');

const target =       let openSql = \
        SELECT COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) as ob 
        FROM journal_lines jl 
        JOIN journal j ON jl.journal_id = j.id 
        WHERE 1=1
      \;;
      
const replacement =       let openSql = \
        SELECT jl.account_code, COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) as ob 
        FROM journal_lines jl 
        JOIN journal j ON jl.journal_id = j.id 
        WHERE 1=1
      \;;
      
content = content.replace(target, replacement);

const target2 =       const openRes = await db.queryOne<any>(openSql, openParams);
      const opening_balance = Number(openRes?.ob ?? 0);;

const replacement2 =       openSql += " GROUP BY jl.account_code";
      const openRes = await db.query<any>(openSql, openParams);
      const opening_balances: Record<string, number> = {};
      openRes.forEach((r: any) => opening_balances[r.account_code] = Number(r.ob ?? 0));
      const opening_balance = opening_balances[account_code ?? ""] ?? 0;;
      
content = content.replace(target2, replacement2);

content = content.replace(eturn res.json({ data: { lines, opening_balance }, error: null });, eturn res.json({ data: { lines, opening_balance, opening_balances }, error: null }););

fs.writeFileSync('E:/Margalla Gateaway/Margalla Gateaway/server/src/routes/queryBridge.ts', content, 'utf8');

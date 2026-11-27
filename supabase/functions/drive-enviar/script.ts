// Script do Google (Apps Script) que roda na conta do Lucas: recebe cada contagem/checklist do portal,
// acrescenta as linhas na planilha do Drive dele (uma aba por tipo e mês) e envia o e-mail com o resultado.
export const SCRIPT = `/* Fat Buddha · Portal Operacional → Drive e e-mail
 * Cole este código em script.google.com (Novo projeto), salve e implante como "App da Web".
 * Não altere o SEGREDO: é ele que garante que só o portal grava na planilha. */
const SEGREDO = '__SEGREDO__';
const NOME_PASTA = 'Fat Buddha · Portal Operacional';
const NOME_PLANILHA = 'Fat Buddha · Contagens e checklists';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.segredo !== SEGREDO) return saida({ ok: false, erro: 'segredo inválido' });
    const ss = planilha();
    if (b.teste) {
      if (b.email && b.email.para && b.email.para.length) enviarEmail(b.email, ss.getUrl());
      return saida({ ok: true, url: ss.getUrl(), cota: MailApp.getRemainingDailyQuota() });
    }
    const nome = (b.aba + ' · ' + b.mes).slice(0, 99);
    let sh = ss.getSheetByName(nome);
    const cab = b.colunas.concat(['Ref']);
    if (!sh) {
      sh = ss.insertSheet(nome);
      sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#1d1715').setFontColor('#f7eee6');
      sh.setFrozenRows(1);
      sh.hideColumns(cab.length);
      const pad = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
      if (pad && ss.getSheets().length > 1) ss.deleteSheet(pad);
    }
    // salvo de novo: tira as linhas antigas do mesmo registro
    const ult = sh.getLastRow();
    if (ult > 1) {
      const refs = sh.getRange(2, cab.length, ult - 1, 1).getValues();
      for (let i = refs.length - 1; i >= 0; i--) if (refs[i][0] === b.ref) sh.deleteRow(i + 2);
    }
    if (b.linhas.length) {
      const rows = b.linhas.map(function (l) { return l.slice(0, b.colunas.length).concat([b.ref]); });
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, cab.length).setValues(rows);
    }
    const url = ss.getUrl() + '#gid=' + sh.getSheetId();
    if (b.email && b.email.para && b.email.para.length) enviarEmail(b.email, url);
    return saida({ ok: true, url: url });
  } catch (err) {
    return saida({ ok: false, erro: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return saida({ ok: true, app: 'fat-buddha-drive' }); }

function enviarEmail(m, url) {
  MailApp.sendEmail({ to: m.para.join(','), subject: m.assunto, htmlBody: String(m.html).split('{{PLANILHA}}').join(url), name: 'Fat Buddha · Portal Operacional' });
}

function planilha() {
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty('PLANILHA');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  const it = DriveApp.getFoldersByName(NOME_PASTA);
  const pasta = it.hasNext() ? it.next() : DriveApp.createFolder(NOME_PASTA);
  const ss = SpreadsheetApp.create(NOME_PLANILHA);
  DriveApp.getFileById(ss.getId()).moveTo(pasta);
  p.setProperty('PLANILHA', ss.getId());
  return ss;
}

// rode esta função uma vez no editor (botão Executar) para autorizar Drive, Planilhas e e-mail
function autorizar() {
  const ss = planilha();
  Logger.log('Planilha: ' + ss.getUrl() + ' · e-mails restantes hoje: ' + MailApp.getRemainingDailyQuota());
}

function saida(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
`;

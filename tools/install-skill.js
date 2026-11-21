/* 安装 seedimage-draw 技能：
 *   node tools/install-skill.js            安装到 DSH 用户级 skill 目录（所有会话可用）
 *   node tools/install-skill.js --project  安装到 <当前目录>/.dsh/skills（只对当前项目生效）
 *   node tools/install-skill.js --target D:\some\dir
 *
 * DSH 的 skill 发现顺序（见 @deepseek-ai/dsh-skill-filesystem）：
 *   100  <项目根>/.dsh/skills
 *   200  <项目根>/.agents/skills
 *   300  配置里的 customSkillDirs
 *   400  <DSH_HOME>/skills            ← 默认装这里
 *   500  <AGENTS_HOME>/skills
 * 每个 skill 是一个目录，里面必须有 SKILL.md。装好后无需重启，watcher 会自动发现。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const SRC = path.join(__dirname, '..', 'skill', 'seedimage-draw');
const NAME = 'seedimage-draw';

function userSkillRoot() {
  const home = process.env.DSH_HOME
    || path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'dsh-desktop', 'harness');
  return path.join(home, 'skills');
}

function main() {
  const argv = process.argv.slice(2);
  let target;
  if (argv.includes('--project')) {
    target = path.join(process.cwd(), '.dsh', 'skills');
  } else {
    const i = argv.indexOf('--target');
    target = i >= 0 ? argv[i + 1] : userSkillRoot();
  }
  if (!target) {
    console.error('用法: node tools/install-skill.js [--project | --target <目录>]');
    process.exit(2);
  }
  if (!fs.existsSync(path.join(SRC, 'SKILL.md'))) {
    console.error('找不到技能源目录：' + SRC);
    process.exit(1);
  }

  const dest = path.join(target, NAME);
  fs.mkdirSync(target, { recursive: true });

  /* 不用 fs.cpSync，也不先删目录：
     Windows 上 skill 目录被 DSH 的 watcher 盯着，先删除再复制会撞上 EIO（拒绝访问）。
     改成逐个文件覆盖复制，目标目录里多余的旧文件最后再清掉。 */
  const copied = [];
  copyTree(SRC, dest, copied);
  pruneExtras(SRC, dest);
  const files = copied.map((p) => path.relative(dest, p).replace(/\\/g, '/'));

  console.log('已安装技能 ' + NAME + ' → ' + dest);
  for (const f of files.sort()) console.log('  ' + f);
  console.log('\n代码编辑器里的会话会自动发现它（无需重启）。');
  console.log('自检： node "' + path.join(dest, 'scripts', 'selftest.mjs') + '"');
}

/** 递归覆盖复制（带一次重试，避开 watcher 短暂占用） */
function copyTree(src, dest, copied) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to, copied);
      continue;
    }
    try {
      fs.copyFileSync(from, to);
    } catch (err) {
      // 目标可能被短暂占用：稍等再试一次
      const until = Date.now() + 600;
      while (Date.now() < until) { /* 忙等 ~0.6s */ }
      fs.copyFileSync(from, to);
    }
    copied.push(to);
  }
}

/** 删除目标目录里源目录已经没有的文件（例如重命名/移除的旧文件） */
function pruneExtras(src, dest) {
  for (const entry of fs.readdirSync(dest, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (!fs.existsSync(from)) {
      fs.rmSync(to, { recursive: true, force: true });
      continue;
    }
    if (entry.isDirectory()) pruneExtras(from, to);
  }
}

main();

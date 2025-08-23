// 游戏分类及编号
export const gameCategories = [
  {
    type: '网游竞技',
    games: [
      'DOTA2', '英雄联盟', 'PUBG', '三角洲行动', 'CS2', '炉石传说', '穿越火线', '云顶之奕', '魔兽世界', '无畏契约', 'DNF', 'APEX', '三国杀', '魔兽争霸', '守望先锋', 'NBA2K', '逆战', '暗黑破坏神'
    ]
  },
  {
    type: '主机单机',
    games: [
      '黑神话：悟空', '战地系列', '街霸系列', '永劫无间', '主机游戏', '马里奥系列', '宝可梦系列', '塞尔达系列', '橙光', '刺客信条', '杀戮尖塔', '三国志系列', '星露谷物语', '我的世界', '泰拉瑞亚', '饥荒', '空洞骑士', '雀魂麻将', '魂游'
    ]
  },
  {
    type: '二次元游戏',
    games: [
      '原神', '绝区零', '鸣潮', '崩坏：星穹铁道', '明日方舟', '碧蓝航线', '阴阳师', '蔚蓝档案', '无尽梦回', '尘白禁区', '暗喻幻想', '七龙珠'
    ]
  },
  {
    type: '手游',
    games: [
      '王者荣耀', '和平精英', '金铲铲', '火影忍者', '第五人格', 'LOL手游', 'CF手游', '永劫无间手游', 'QQ飞车', '欢乐斗地主', '率土之滨', '三国：谋定天下', '游戏王'
    ]
  }
];

// 展平所有游戏并编号
export const allGames = [];
export const gameIdToInfo = {}; // {id: {name, type}}
export const gameNameToId = {}; // {name: id}
let id = 0;
for (const cat of gameCategories) {
  for (const name of cat.games) {
    allGames.push({ id, name, type: cat.type });
    gameIdToInfo[id] = { name, type: cat.type };
    gameNameToId[name] = id;
    id++;
  }
}

// 用于前端展示和编号转换
export const getGameNameById = (id) => gameIdToInfo[id]?.name || '未知游戏';
export const getGameTypeById = (id) => gameIdToInfo[id]?.type || '未知类型';
export const getGameIdByName = (name) => gameNameToId[name] ?? -1;

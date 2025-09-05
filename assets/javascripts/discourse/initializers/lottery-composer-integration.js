// assets/javascripts/discourse/initializers/lottery-composer-integration.js
// 修复了布尔值属性设置错误

import { withPluginApi } from "discourse/lib/plugin-api";
import { onToolbarCreate } from "discourse/components/d-editor";

function initializeLotteryComposer(api) {
  const siteSettings = api.container.lookup("site-settings:main");
  
  if (!siteSettings.lottery_enabled) {
    return;
  }
  
  console.log("🎲 Lottery: Initializing composer integration");

  // 检查分类权限的函数
  function canInsertLottery() {
    const composer = api.container.lookup("controller:composer");
    if (!composer) {
      return false;
    }

    const allowedCategories = siteSettings.lottery_allowed_categories;
    if (!allowedCategories) {
      return true;
    }

    const allowedIds = allowedCategories
      .split("|")
      .map(function(id) { return Number(id.trim()); })
      .filter(function(id) { return !isNaN(id) && id > 0; });

    const currentCategoryId = Number(composer.get("model.categoryId") || 0);
    return allowedIds.length === 0 || allowedIds.includes(currentCategoryId);
  }

  // 添加工具栏按钮
  onToolbarCreate(function(toolbar) {
    toolbar.addButton({
      title: "插入抽奖",
      id: "insertLottery", 
      group: "extras",
      icon: "dice",
      perform: function(e) {
        if (!siteSettings.lottery_enabled) {
          alert("抽奖功能已被管理员关闭");
          return;
        }

        if (!canInsertLottery()) {
          alert("当前分类不支持抽奖功能");
          return;
        }

        // 插入抽奖模板
        const lotteryTemplate = buildLotteryTemplate();
        e.applySurround(lotteryTemplate, "", "");
      }
    });
  });

  function buildLotteryTemplate() {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const defaultTime = tomorrow.toISOString().slice(0, 16);
    
    return `\n[lottery]\n活动名称：请填写活动名称\n奖品说明：请描述奖品详情\n开奖时间：${defaultTime}\n获奖人数：1\n参与门槛：5\n补充说明：（可选）请填写补充说明\n[/lottery]\n\n`;
  }

  // 扩展Composer控制器以处理数据传递
  api.modifyClass("controller:composer", {
    pluginId: "discourse-lottery-v3",
    
    save: function(options) {
      console.log("🎲 Composer save intercepted");
      
      // 修复：确保options是对象
      if (!options || typeof options !== 'object') {
        options = {};
      }
      
      const model = this.get("model");
      if (!model) {
        console.log("🎲 No model found, skipping lottery processing");
        return this._super(options);
      }
      
      const content = model.get("reply") || "";
      
      // 检查内容中是否有抽奖标记
      const lotteryMatch = content.match(/\[lottery\](.*?)\[\/lottery\]/s);
      
      if (lotteryMatch) {
        console.log("🎲 Found lottery content in post");
        
        try {
          const lotteryData = this.extractAndValidateLotteryData(lotteryMatch[1]);
          
          if (lotteryData) {
            console.log("🎲 Setting lottery data for transmission");
            
            // 修复：直接设置到options中，不要试图在model上设置不存在的属性
            options.lottery = JSON.stringify(lotteryData);
            
            console.log("🎲 Lottery data set for transmission");
          }
        } catch (error) {
          console.error("🎲 Error processing lottery data:", error);
          alert("抽奖数据处理失败: " + error.message);
          return;
        }
      }
      
      return this._super(options);
    },
    
    extractAndValidateLotteryData: function(lotteryContent) {
      console.log("🎲 Extracting lottery data from content");
      
      const data = {};
      const lines = lotteryContent.split('\n');
      
      lines.forEach(function(line) {
        line = line.trim();
        if (line && line.includes('：')) {
          const parts = line.split('：', 2);
          const key = parts[0].trim();
          const value = parts[1] ? parts[1].trim() : '';
          
          switch (key) {
            case '活动名称':
              data.prize_name = value;
              break;
            case '奖品说明':
              data.prize_details = value;
              break;
            case '开奖时间':
              data.draw_time = value;
              break;
            case '获奖人数':
              data.winners_count = parseInt(value) || 1;
              break;
            case '指定楼层':
            case '指定中奖楼层':
              if (value) {
                data.specified_posts = value;
              }
              break;
            case '参与门槛':
              const participants = value.match(/\d+/);
              data.min_participants = participants ? parseInt(participants[0]) : 5;
              break;
            case '补充说明':
              if (value) {
                data.additional_notes = value;
              }
              break;
            case '奖品图片':
              if (value) {
                data.prize_image = value;
              }
              break;
          }
        }
      });
      
      // 设置默认值
      data.backup_strategy = data.backup_strategy || 'continue';
      
      // 验证必填字段
      if (!data.prize_name || !data.prize_details || !data.draw_time) {
        throw new Error("缺少必填字段：活动名称、奖品说明或开奖时间");
      }
      
      // 验证时间格式
      try {
        const drawDate = new Date(data.draw_time);
        if (isNaN(drawDate.getTime()) || drawDate <= new Date()) {
          throw new Error("开奖时间无效或不是未来时间");
        }
      } catch (e) {
        throw new Error("开奖时间格式错误");
      }
      
      // 验证参与门槛
      const globalMin = siteSettings.lottery_min_participants_global || 5;
      if (data.min_participants < globalMin) {
        throw new Error("参与门槛不能低于全局设置的 " + globalMin + " 人");
      }
      
      console.log("🎲 Lottery data validation passed:", data);
      return data;
    }
  });

  console.log("🎲 Lottery: Composer integration completed");
}

export default {
  name: "lottery-composer-integration",
  initialize: function() {
    withPluginApi("0.8.7", initializeLotteryComposer);
  }
};

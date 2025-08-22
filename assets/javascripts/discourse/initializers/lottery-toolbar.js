import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-toolbar",
  initialize() {
    withPluginApi("2.1.0", (api) => {
      // 检查分类是否允许抽奖的辅助函数
      function canInsertLottery() {
        const composer = api.container.lookup("controller:composer");
        if (!composer) return false;
        
        const allowedCategories = composer.siteSettings?.lottery_allowed_categories;
        if (!allowedCategories) return false;
        
        const allowedIds = allowedCategories
          .split("|")
          .map(id => Number(id.trim()))
          .filter(id => !isNaN(id) && id > 0);
        
        const currentCategoryId = Number(composer.get("model.categoryId") || 0);
        return allowedIds.includes(currentCategoryId);
      }

      // 处理抽奖插入的函数
      function insertLottery(toolbarEvent) {
        const composer = api.container.lookup("controller:composer");
        if (!composer) return;

        const prizeName = prompt("请输入活动名称：");
        if (!prizeName) return;
        
        const prizeDetails = prompt("请输入奖品说明：");
        if (!prizeDetails) return;
        
        const drawTime = prompt("请输入开奖时间 (格式: 2025-08-24T20:00)：");
        if (!drawTime) return;
        
        // 验证时间格式
        try {
          const testDate = new Date(drawTime);
          if (isNaN(testDate.getTime()) || testDate <= new Date()) {
            alert("时间格式无效或时间不能是过去时间");
            return;
          }
        } catch (e) {
          alert("时间格式无效");
          return;
        }
        
        const lotteryData = {
          prize_name: prizeName,
          prize_details: prizeDetails,
          draw_time: drawTime,
          winners_count: 1,
          specified_posts: "",
          min_participants: composer.siteSettings?.lottery_min_participants_global || 5,
          backup_strategy: "continue",
          additional_notes: ""
        };
        
        // 缓存数据供后续使用
        window.lotteryFormDataCache = lotteryData;
        
        // 在编辑器中插入占位符文本
        const placeholder = `\n\n[lottery]\n活动名称：${prizeName}\n奖品说明：${prizeDetails}\n开奖时间：${drawTime}\n[/lottery]\n\n`;
        
        // 使用 toolbarEvent 的 addText 方法插入文本
        if (toolbarEvent && toolbarEvent.addText) {
          toolbarEvent.addText(placeholder);
        } else {
          // 备用方法：直接修改 composer
          const currentText = composer.get("model.reply") || "";
          composer.set("model.reply", currentText + placeholder);
        }
      }

      // 方法1：使用最新的 addComposerToolbarPopupMenuOption API
      api.addComposerToolbarPopupMenuOption({
        action: insertLottery,
        icon: "dice", 
        label: "插入抽奖",
        condition: () => canInsertLottery()
      });

      // 方法2：如果上面不工作，使用传统的 onToolbarCreate（这个更稳定）
      /*
      api.onToolbarCreate((toolbar) => {
        toolbar.addButton({
          id: "lottery-insert",
          group: "extras",
          icon: "dice",
          title: "插入抽奖",
          perform: (e) => {
            const composer = api.container.lookup("controller:composer");
            if (composer && canInsertLottery()) {
              insertLottery({ addText: (text) => {
                const currentText = composer.get("model.reply") || "";
                composer.set("model.reply", currentText + text);
              }});
            }
          },
          condition: () => canInsertLottery()
        });
      });
      */
    });
  },
};

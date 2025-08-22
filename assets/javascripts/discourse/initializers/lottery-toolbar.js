import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-toolbar",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      // 检查分类是否允许抽奖的辅助函数
      function canInsertLottery(composer) {
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
      function handleLotteryInsert(composer) {
        const prizeName = prompt("请输入活动名称：");
        if (!prizeName) return;
        
        const prizeDetails = prompt("请输入奖品说明：");
        if (!prizeDetails) return;
        
        const drawTime = prompt("请输入开奖时间 (格式: 2025-08-24T20:00)：");
        if (!drawTime) return;
        
        const lotteryData = {
          prize_name: prizeName,
          prize_details: prizeDetails,
          draw_time: drawTime,
          winners_count: 1,
          specified_posts: "",
          min_participants: 10,
          backup_strategy: "continue",
          additional_notes: ""
        };
        
        // 缓存表单数据
        window.lotteryFormDataCache = lotteryData;
        
        // 在编辑器中插入占位符
        const placeholder = `\n\n[lottery]\n活动名称：${prizeName}\n奖品说明：${prizeDetails}\n开奖时间：${drawTime}\n[/lottery]\n\n`;
        const currentText = composer.get("model.reply") || "";
        composer.set("model.reply", currentText + placeholder);
      }

      // 方法1：使用 addComposerToolbarPopupMenuOption
      api.addComposerToolbarPopupMenuOption({
        action: "insertLottery",
        icon: "dice",
        label: "composer.lottery_insert",
        condition: (composer) => canInsertLottery(composer)
      });

      // 注册对应的 action
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",
        
        actions: {
          insertLottery() {
            handleLotteryInsert(this);
          }
        }
      });

      // 方法2：如果上面的方法不工作，尝试这个备用方案
      /*
      api.onToolbarCreate((toolbar) => {
        toolbar.addButton({
          id: "lottery-button",
          group: "extras",
          icon: "dice",
          title: "插入抽奖",
          perform: (e) => {
            const composer = e.target.closest(".d-editor-input")?.closest(".composer-fields")?.controller;
            if (composer && canInsertLottery(composer)) {
              handleLotteryInsert(composer);
            }
          },
          condition: () => {
            const composer = this.container.lookup("controller:composer");
            return composer && canInsertLottery(composer);
          }
        });
      });
      */
    });
  },
};

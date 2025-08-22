import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-toolbar",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      // 添加工具栏按钮 - 使用正确的 API
      api.addToolbarPopupMenuOptionsCallback((composer) => {
        // 检查是否在允许的分类中
        const allowedCategories = api.container.lookup("service:site-settings").lottery_allowed_categories;
        if (!allowedCategories) return [];

        const allowedIds = allowedCategories
          .split("|")
          .map(id => Number(id.trim()))
          .filter(id => !isNaN(id) && id > 0);

        const currentCategoryId = Number(composer.get("model.categoryId") || 0);

        console.log("🎲 Lottery toolbar check:", { allowedIds, currentCategoryId });

        if (!allowedIds.includes(currentCategoryId)) {
          return [];
        }

        // 返回菜单选项
        return [
          {
            action: "insertLottery",
            icon: "dice",
            label: "插入抽奖"
          }
        ];
      });

      // 正确的方式扩展 composer controller
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",

        actions: {
          insertLottery() {
            console.log("🎲 Insert lottery action triggered");
            this.send("showLotteryModal");
          },

          showLotteryModal() {
            console.log("🎲 Showing lottery modal");
            
            // 使用 Discourse 的 modal 系统
            const modal = api.container.lookup("service:modal");
            if (modal) {
              modal.show("lottery-settings", {
                model: { composer: this }
              });
            } else {
              // 备用方案
              this._fallbackLotteryCreation();
            }
          }
        },

        _fallbackLotteryCreation() {
          const prizeName = prompt("活动名称:");
          if (!prizeName) return;

          const prizeDetails = prompt("奖品说明:");
          if (!prizeDetails) return;

          const drawTime = prompt("开奖时间 (YYYY-MM-DDTHH:MM):");
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

          // 保存数据
          window.lotteryFormDataCache = lotteryData;

          // 插入到编辑器
          const placeholder = `\n\n[lottery]\n活动名称: ${prizeName}\n奖品说明: ${prizeDetails}\n开奖时间: ${drawTime}\n[/lottery]\n\n`;
          const currentText = this.get("model.reply") || "";
          this.set("model.reply", currentText + placeholder);

          console.log("🎲 Lottery inserted via fallback method");
        }
      });

      console.log("🎲 Lottery toolbar initialized");
    });
  },
};

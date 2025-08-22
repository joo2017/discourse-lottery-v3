import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-toolbar",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      // 添加编辑器工具栏按钮
      api.addToolbarPopupMenuOptionsCallback(() => {
        return {
          action: "insertLottery",
          icon: "dice",
          label: "lottery.toolbar.title",
          condition: "canInsertLottery"
        };
      });

      // 定义按钮条件
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",
        
        canInsertLottery() {
          // 检查是否在允许的分类中
          const allowedCategories = this.siteSettings.lottery_allowed_categories;
          if (!allowedCategories) return false;
          
          const allowedIds = allowedCategories
            .split("|")
            .map(id => Number(id.trim()))
            .filter(id => !isNaN(id) && id > 0);
          
          const currentCategoryId = Number(this.get("model.categoryId") || 0);
          
          console.log("🎲 Lottery toolbar check:");
          console.log("  Allowed categories:", allowedIds);
          console.log("  Current category:", currentCategoryId);
          console.log("  Can show:", allowedIds.includes(currentCategoryId));
          
          return allowedIds.includes(currentCategoryId);
        },

        actions: {
          insertLottery() {
            console.log("🎲 Insert lottery button clicked");
            
            // 打开抽奖设置对话框
            this.openLotteryDialog();
          }
        },

        openLotteryDialog() {
          // 创建抽奖对话框
          this.modal.show("lottery-settings", {
            model: {
              composer: this
            }
          });
        }
      });
    });
  },
};

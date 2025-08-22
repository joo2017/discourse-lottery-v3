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
        
        console.log("🎲 Lottery toolbar check:");
        console.log("  Allowed categories:", allowedIds);
        console.log("  Current category:", currentCategoryId);
        console.log("  Can show:", allowedIds.includes(currentCategoryId));
        
        return allowedIds.includes(currentCategoryId);
      }

      // 添加编辑器工具栏按钮
      api.addToolbarPopupMenuOptionsCallback((composer) => {
        console.log("🎲 Toolbar popup menu callback called");
        
        if (canInsertLottery(composer)) {
          console.log("🎲 Adding lottery option to menu");
          return {
            action: "insertLottery",
            icon: "dice",
            label: "插入抽奖",
            className: "lottery-toolbar-button"
          };
        } else {
          console.log("🎲 Not adding lottery option - category not allowed");
          return null;
        }
      });

      // 修改 composer 控制器
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",
        
        actions: {
          insertLottery() {
            console.log("🎲 Insert lottery action called");
            this.openLotteryDialog();
          }
        },

        openLotteryDialog() {
          console.log("🎲 Opening lottery dialog");
          
          // 检查 modal 服务是否存在
          if (this.modal) {
            this.modal.show("lottery-settings", {
              model: {
                composer: this
              }
            });
          } else {
            console.error("🎲 Modal service not found");
            alert("抽奖对话框暂时无法打开，请稍后再试。");
          }
        }
      });

      console.log("🎲 Lottery toolbar initialized successfully");
    });
  },
};

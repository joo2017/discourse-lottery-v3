import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-editor-button",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      // 添加编辑器按钮（直接在工具栏上，不是弹出菜单）
      api.addComposerToolbarPopupMenuOption({
        action: "insertLottery",
        icon: "dice",
        label: "lottery.toolbar.title",
        condition(composer) {
          // 检查是否在允许的分类中
          const allowedCategories = composer.siteSettings?.lottery_allowed_categories;
          if (!allowedCategories) return false;
          
          const allowedIds = allowedCategories
            .split("|")
            .map(id => Number(id.trim()))
            .filter(id => !isNaN(id) && id > 0);
          
          const currentCategoryId = Number(composer.get("model.categoryId") || 0);
          
          console.log("🎲 Checking lottery button condition:");
          console.log("  Allowed categories:", allowedIds);
          console.log("  Current category:", currentCategoryId);
          console.log("  Should show:", allowedIds.includes(currentCategoryId));
          
          return allowedIds.includes(currentCategoryId);
        }
      });

      // 添加 action 到 composer
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",

        actions: {
          insertLottery() {
            console.log("🎲 Insert lottery action triggered");
            this.openLotteryModal();
          }
        },

        openLotteryModal() {
          console.log("🎲 Opening lottery modal");
          
          // 使用标准的 showModal 方法
          this.modal.show("lottery-modal");
        }
      });

      console.log("🎲 Lottery editor button initialized");
    });
  },
};

import { withPluginApi } from "discourse/lib/plugin-api";
import showModal from "discourse/lib/show-modal";

export default {
  name: "lottery-toolbar",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 抽奖工具栏初始化开始...");

      // 检查分类是否允许抽奖
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

      // 添加工具栏按钮
      api.onToolbarCreate((toolbar) => {
        console.log("🎲 添加抽奖工具栏按钮");

        toolbar.addButton({
          id: "lottery-insert",
          group: "extras",
          icon: "dice",
          title: "插入抽奖",
          className: "lottery-toolbar-btn",
          perform: () => {
            console.log("🎲 抽奖按钮被点击");

            if (!canInsertLottery()) {
              alert("当前分类不支持抽奖功能");
              return;
            }

            // 使用官方的 showModal API
            showModal("lottery-form", {
              model: {
                // 传递必要的数据
                composer: api.container.lookup("controller:composer"),
                siteSettings: api.container.lookup("controller:composer").siteSettings
              }
            });
          }
        });
      });

      console.log("🎲 抽奖工具栏初始化完成");
    });
  },
};

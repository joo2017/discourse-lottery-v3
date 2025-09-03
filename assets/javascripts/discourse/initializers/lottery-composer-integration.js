// assets/javascripts/discourse/initializers/lottery-composer-integration.js
import { withPluginApi } from "discourse/lib/plugin-api";
import LotteryFormModal from "../components/modal/lottery-form-modal";

export default {
  name: "lottery-composer-integration",
  initialize() {
    withPluginApi("1.4.0", (api) => {
      console.log("🎲 Lottery: 初始化编辑器集成");

      api.serializeOnCreate('lottery');
      api.serializeToDraft('lottery');
      api.serializeToTopic('lottery', 'topic.lottery');

      function canInsertLottery() {
        const composer = api.container.lookup("controller:composer");
        if (!composer) return false;

        const siteSettings = api.container.lookup("service:site-settings");
        const allowedCategories = siteSettings?.lottery_allowed_categories;
        
        if (!allowedCategories) return true;

        const allowedIds = allowedCategories
          .split("|")
          .map(id => Number(id.trim()))
          .filter(id => !isNaN(id) && id > 0);

        const currentCategoryId = Number(composer.get("model.categoryId") || 0);
        return allowedIds.includes(currentCategoryId);
      }

      api.onToolbarCreate((toolbar) => {
        toolbar.addButton({
          title: "插入抽奖",
          id: "insertLottery", 
          group: "extras",
          icon: "dice",
          shortcut: "Ctrl+Shift+L",
          perform: (e) => {
            const siteSettings = api.container.lookup("service:site-settings");
            
            if (!siteSettings?.lottery_enabled) {
              alert("抽奖功能已被管理员关闭");
              return;
            }

            if (!canInsertLottery()) {
              alert("当前分类不支持抽奖功能");
              return;
            }

            const modal = api.container.lookup("service:modal");
            const composer = api.container.lookup("controller:composer");
            
            modal.show(LotteryFormModal, {
              model: { 
                toolbarEvent: e,
                composer: composer,
                siteSettings: siteSettings
              }
            });
          }
        });
      });

      console.log("🎲 Lottery: 编辑器集成初始化完成");
    });
  },
};

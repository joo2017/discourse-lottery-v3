// assets/javascripts/discourse/initializers/lottery-initializer.js (FINAL, PRODUCTION-READY CODE)
import { withPluginApi } from "discourse/lib/plugin-api";
import LotteryFormModal from "../components/modal/lottery-form-modal"; // 现在这个导入应该是安全的

export default {
  name: "lottery-initializer",
  initialize() {
    withPluginApi("1.4.0", (api) => {
      api.serializeOnCreate('lottery');

      function canInsertLottery(composer) {
        if (!composer || !composer.get("model")) { return false; }
        const siteSettings = api.container.lookup("service:site-settings");
        if (!siteSettings.lottery_allowed_categories) { return true; }
        const allowedIds = siteSettings.lottery_allowed_categories.split("|").map(id => parseInt(id.trim(), 10)).filter(id => id > 0);
        if (allowedIds.length === 0) { return true; }
        const currentCategoryId = parseInt(composer.get("model").categoryId || 0, 10);
        return allowedIds.includes(currentCategoryId);
      }

      api.onToolbarCreate((toolbar) => {
        if (toolbar.context.creatingTopic) {
          toolbar.addButton({
            id: "insertLottery",
            group: "extras",
            icon: "dice",
            title: "js.lottery.toolbar.title",
            perform: (e) => {
              const siteSettings = api.container.lookup("service:site-settings");
              if (!siteSettings.lottery_enabled) {
                api.container.lookup("service:dialog").alert("抽奖功能当前已被管理员禁用。");
                return;
              }
              const composer = api.container.lookup("controller:composer");
              if (!canInsertLottery(composer)) {
                 api.container.lookup("service:dialog").alert("当前分类不允许创建抽奖活动。");
                 return;
              }
              const modal = api.container.lookup("service:modal");
              modal.show(LotteryFormModal, {
                model: { composer: composer, siteSettings: siteSettings }
              });
            }
          });
        }
      });
    });
  },
};

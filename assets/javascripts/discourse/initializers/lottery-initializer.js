// assets/javascripts/discourse/initializers/lottery-initializer.js (FINAL AND DEFINITIVE CODE)
import { withPluginApi } from "discourse/lib/plugin-api";
import LotteryFormModal from "../components/modal/lottery-form-modal";

export default {
  name: "lottery-initializer",
  initialize() {
    withPluginApi("1.4.0", (api) => {
      // -------------------------------------------------------------------
      // 功能一：解决数据传递问题 (这是核心)
      // -------------------------------------------------------------------
      // 这行代码是官方推荐的、最健壮的数据传递方式。
      // 它告诉Discourse在创建主题时，自动将名为 'lottery' 的数据包含在请求中。
      // 它将保持不变。
      api.serializeOnCreate('lottery');

      // -------------------------------------------------------------------
      // 功能二：恢复工具栏按钮 (这是必要的补充)
      // -------------------------------------------------------------------
      // 这是一个辅助函数，用于检查当前分类是否允许创建抽奖。
      function canInsertLottery(composer) {
        if (!composer || !composer.get("model")) { return false; }
        const siteSettings = api.container.lookup("service:site-settings");
        if (!siteSettings.lottery_allowed_categories) { return true; }
        const allowedIds = siteSettings.lottery_allowed_categories.split("|").map(id => parseInt(id.trim(), 10)).filter(id => id > 0);
        if (allowedIds.length === 0) { return true; }
        const currentCategoryId = parseInt(composer.get("model").categoryId || 0, 10);
        return allowedIds.includes(currentCategoryId);
      }

      // 使用官方API在工具栏上创建按钮。
      api.onToolbarCreate((toolbar) => {
        // 确保按钮只在“创建新话题”时出现。
        if (toolbar.context.creatingTopic) {
          toolbar.addButton({
            id: "insertLottery",
            group: "extras",
            icon: "dice",
            title: "js.lottery.toolbar.title", // 对应 client.zh_CN.yml 中的翻译
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

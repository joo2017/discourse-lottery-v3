// assets/javascripts/discourse/initializers/lottery-initializer.js
import { withPluginApi } from "discourse/lib/plugin-api";
import LotteryFormModal from "../components/modal/lottery-form-modal";

export default {
  name: "lottery-initializer",
  initialize() {
    withPluginApi("1.4.0", (api) => {
      console.log("LotteryPlugin: Initializer starting...");

      // 关键步骤: 告诉Discourse在创建主题时，序列化名为 'lottery' 的属性。
      // 这会自动从 composer model 中获取 'lottery' 属性，并将其包含在发送到服务器的POST请求中。
      api.serializeOnCreate('lottery');

      // 检查当前分类是否允许创建抽奖
      function canInsertLottery(composer) {
        if (!composer) return false;

        const siteSettings = api.container.lookup("service:site-settings");
        // 如果管理员没有设置任何特定分类，则默认所有分类都允许
        if (!siteSettings.lottery_allowed_categories) {
          return true;
        }

        const allowedIds = siteSettings.lottery_allowed_categories
          .split("|")
          .map(id => parseInt(id.trim(), 10))
          .filter(id => id > 0);

        const currentCategoryId = parseInt(composer.get("model.categoryId") || 0, 10);
        
        // 如果允许的分类列表为空，也认为所有分类都允许
        if (allowedIds.length === 0) return true;

        return allowedIds.includes(currentCategoryId);
      }

      // 添加工具栏按钮
      api.onToolbarCreate((toolbar) => {
        // 只在创建新主题时显示按钮
        if (toolbar.context.creatingTopic) {
          toolbar.addButton({
            id: "insertLottery",
            group: "extras",
            icon: "dice",
            title: "lottery.toolbar.title",
            perform: (e) => {
              const siteSettings = api.container.lookup("service:site-settings");
              if (!siteSettings.lottery_enabled) {
                alert("抽奖功能当前已被禁用。");
                return;
              }

              const composer = api.container.lookup("controller:composer");
              if (!canInsertLottery(composer)) {
                alert("当前分类不允许创建抽奖活动。");
                return;
              }

              const modal = api.container.lookup("service:modal");
              modal.show(LotteryFormModal, {
                model: {
                  composer: composer,
                  siteSettings: siteSettings
                }
              });
            }
          });
        }
      });

      console.log("LotteryPlugin: Initializer finished.");
    });
  },
};

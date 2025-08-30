// assets/javascripts/discourse/initializers/lottery-initializer.js (FINAL VERSION)
import { withPluginApi } from "discourse/lib/plugin-api";
import LotteryFormModal from "../components/modal/lottery-form-modal";

export default {
  name: "lottery-initializer",
  initialize() {
    withPluginApi("1.4.0", (api) => {
      // 1. 解决数据传递的核心：
      // 这行代码是整个修复方案的基石。它以官方推荐的方式，
      // 自动处理将名为 'lottery' 的数据从前端编辑器模型发送到后端的操作。
      api.serializeOnCreate('lottery');

      // 辅助函数：检查当前分类是否允许创建抽奖
      function canInsertLottery(composer) {
        if (!composer || !composer.get("model")) {
            return false;
        }
        const siteSettings = api.container.lookup("service:site-settings");
        if (!siteSettings.lottery_allowed_categories) { return true; }
        const allowedIds = siteSettings.lottery_allowed_categories
          .split("|").map(id => parseInt(id.trim(), 10)).filter(id => id > 0);
        if (allowedIds.length === 0) { return true; }
        const currentCategoryId = parseInt(composer.get("model.categoryId") || 0, 10);
        return allowedIds.includes(currentCategoryId);
      }

      // 2. 恢复工具栏按钮的功能：
      // 因为我们删除了旧的 lottery-toolbar.js，所以必须在这里重建按钮。
      api.onToolbarCreate((toolbar) => {
        // 按照您的设计蓝图，抽奖功能只在“新建主题”时启用。
        // 这个 if 判断确保了按钮只在正确的时间出现。
        if (toolbar.context.creatingTopic) {
          toolbar.addButton({
            id: "insertLottery",
            group: "extras",
            icon: "dice",
            // 使用 i18n 翻译键，确保语言正确显示。
            // 请确保您的 client.zh_CN.yml 文件中有这个路径。
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
                model: {
                  composer: composer,
                  siteSettings: siteSettings
                }
              });
            }
          });
        }
      });
    });
  },
};

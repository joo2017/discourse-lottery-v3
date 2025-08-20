// file: discourse-lottery-v3/assets/javascripts/discourse/initializers/lottery-outlet-initializer.js.es6

import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-outlet-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      // 严格遵循官方文档，使用 decoratePluginOutlet 来安全地挂载组件
      api.decoratePluginOutlet("composer-fields", (helper) => {
        // outletArgs.model 就是 composer 的 model，我们可以从中获取 categoryId
        const model = helper.widget.outletArgs.model;
        const siteSettings = helper.widget.container.lookup("service:site-settings");
        
        if (!siteSettings.lottery_enabled) {
          return;
        }
        
        const allowedCategoriesSetting = siteSettings.lottery_allowed_categories || "";
        const allowedCategories = allowedCategoriesSetting.split('|').map(Number).filter(id => id > 0);
        
        // 在这里进行最核心的判断
        if (model.action === "createTopic" && allowedCategories.includes(model.categoryId)) {
          // 只有在条件满足时，才渲染我们的组件
          return helper.attach("lottery-form", { model: model });
        }
      });

      // 我们仍然需要一个极小化的 modifyClass 来处理保存数据的逻辑
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",
        save(options) {
          const lotteryData = this.get("model.lotteryFormData");
          if (lotteryData) {
            this.get("model").set("custom_fields.lottery", JSON.stringify(lotteryData));
          }
          return this._super(options);
        },
      });
    });
  },
};

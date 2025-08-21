// file: discourse-lottery-v3/assets/javascripts/discourse/initializers/lottery-outlet-initializer.js

import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-outlet-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      // 使用被广泛支持且稳定的 decoratePluginOutlet
      api.decoratePluginOutlet("composer-fields", (helper) => {
        const model = helper.widget.outletArgs.model;
        const siteSettings = helper.widget.container.lookup("service:site-settings");
        
        if (!siteSettings.lottery_enabled) {
          return;
        }
        
        const allowedCategoriesSetting = siteSettings.lottery_allowed_categories || "";
        const allowedCategories = allowedCategoriesSetting.split('|').map(Number).filter(id => id > 0);
        
        if (model.action === "createTopic" && allowedCategories.includes(model.categoryId)) {
          return helper.attach("lottery-form", { 
              model: model, 
              siteSettings: siteSettings
          });
        }
      });

      // 只保留绝对必要的 save 方法修改
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

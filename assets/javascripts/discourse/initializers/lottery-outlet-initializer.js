// file: discourse-lottery-v3/assets/javascripts/discourse/initializers/lottery-outlet-initializer.js

import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-outlet-initializer",
  // 核心修正：移除 container 参数，回归最标准的 initialize 写法
  initialize() {
    withPluginApi("1.0.0", (api) => {
      // 核心修正：使用被官方和社区大量实战验证过的 decoratePluginOutlet
      api.decoratePluginOutlet("composer-fields", (helper) => {
        const model = helper.widget.outletArgs.model;
        const siteSettings = helper.widget.container.lookup("service:site-settings");
        
        if (!siteSettings.lottery_enabled) {
          return;
        }
        
        const allowedCategoriesSetting = siteSettings.lottery_allowed_categories || "";
        const allowedCategories = allowedCategoriesSetting.split('|').map(Number).filter(id => id > 0);
        
        if (model.action === "createTopic" && allowedCategories.includes(model.categoryId)) {
          // 使用 helper.attach 来安全地挂载我们的 Glimmer 组件
          return helper.attach("lottery-form", { 
              model: model, 
              siteSettings: siteSettings
          });
        }
      });

      // 保留最小化的、安全的 save 方法修改
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

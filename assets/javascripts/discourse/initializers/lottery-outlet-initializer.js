// file: discourse-lottery-v3/assets/javascripts/discourse/initializers/lottery-outlet-initializer.js

import { withPluginApi } from "discourse/lib/plugin-api";
import LotteryForm from "../components/lottery-form"; // 核心修正：直接导入组件

export default {
  name: "lottery-outlet-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      // 核心修正：这是解决“弃用警告”的、最现代且安全的方式
      api.registerOutletComponent("composer-fields", {
        // 将组件直接在这里注册
        component: LotteryForm, 
        
        // 在这里编写判断逻辑
        shouldRender(outletArgs, component) {
          const siteSettings = component.siteSettings;
          if (!siteSettings.lottery_enabled) { return false; }

          const allowedCategoriesSetting = siteSettings.lottery_allowed_categories || "";
          const allowedCategories = allowedCategoriesSetting.split('|').map(Number).filter(id => id > 0);
          const model = outletArgs;

          return model.action === 'createTopic' && allowedCategories.includes(model.categoryId);
        },

        // 传递给组件的参数
        args(outletArgs, component) {
          return {
            model: outletArgs,
            siteSettings: component.siteSettings,
          };
        }
      });

      // 保留最小化的 save 方法修改
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

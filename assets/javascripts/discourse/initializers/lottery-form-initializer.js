// file: discourse-lottery-v3/assets/javascripts/discourse/initializers/lottery-form-initializer.js

import { withPluginApi } from "discourse/lib/plugin-api";
import { A } from "@ember/array";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",

        // 计算属性，用于在 connector 中判断是否显示组件
        shouldShowLotteryForm: function () {
          const siteSettings = this.siteSettings;
          if (!siteSettings.lottery_enabled) {
            return false;
          }

          const allowedCategoriesSetting = siteSettings.lottery_allowed_categories || "";
          const allowedCategories = A(allowedCategoriesSetting.split('|').map(Number).filter(id => id > 0));
          const currentCategoryId = this.get('model.categoryId');

          return this.get('model.action') === 'createTopic' &&
                 !allowedCategories.isEmpty() &&
                 allowedCategories.includes(currentCategoryId);
        }.property('model.categoryId', 'model.action'),
        
        // 保存逻辑
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

// file: discourse-lottery-v3/assets/javascripts/discourse/initializers/lottery-form-initializer.js

import { withPluginApi } from "discourse/lib/plugin-api";
import { A } from "@ember/array";
import { computed } from "@ember/object";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",

        shouldShowLotteryForm: computed('model.categoryId', 'model.action', function () {
          // --- DIAGNOSTIC PROBES START ---
          console.log("--- Lottery Form Check ---");

          // 探针 1: 检查插件总开关
          const isPluginEnabled = this.siteSettings.lottery_enabled;
          console.log(`1. Is plugin enabled? -> ${isPluginEnabled}`);
          if (!isPluginEnabled) return false;

          // 探针 2: 检查后台设置的分类列表
          const allowedCategoriesSetting = this.siteSettings.lottery_allowed_categories || "";
          console.log(`2. Allowed categories setting from server: "${allowedCategoriesSetting}"`);
          const allowedCategories = A(allowedCategoriesSetting.split('|').map(Number).filter(id => id > 0));
          console.log("3. Parsed allowed category IDs:", allowedCategories);

          // 探针 3: 检查当前编辑器的 action
          const composerAction = this.get('model.action');
          console.log(`4. Current composer action: "${composerAction}"`);
          const isCreateTopic = composerAction === 'createTopic';
          console.log(`5. Is it 'createTopic'? -> ${isCreateTopic}`);

          // 探针 4: 检查当前选择的分类 ID
          const currentCategoryId = this.get('model.categoryId');
          console.log(`6. Current category ID: ${currentCategoryId}`);
          
          // 探针 5: 检查当前分类是否在允许列表中
          const isCategoryAllowed = !allowedCategories.isEmpty() && allowedCategories.includes(currentCategoryId);
          console.log(`7. Is current category in the allowed list? -> ${isCategoryAllowed}`);
          
          // 最终决策
          const finalDecision = isCreateTopic && isCategoryAllowed;
          console.log(`FINAL DECISION: Should show form? -> ${finalDecision}`);
          console.log("------------------------");
          // --- DIAGNOSTIC PROBES END ---

          return finalDecision;
        }),
        
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

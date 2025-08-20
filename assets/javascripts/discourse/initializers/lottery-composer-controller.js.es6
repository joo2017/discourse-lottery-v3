// file: discourse-lottery-v3/assets/javascripts/discourse/initializers/lottery-composer-controller.js.es6

import { withPluginApi } from "discourse/lib/plugin-api";
import I18n from "discourse-i18n";

export default {
  name: "lottery-composer-controller",

  // 核心修正：使用不带参数的 initialize()，严格遵循官方文档模式
  initialize() {
    withPluginApi("1.0.0", (api) => {

      // 核心修正：在 withPluginApi 内部安全地获取 siteSettings
      const siteSettings = api.container.lookup("service:site-settings");
      
      // 如果插件总开关是关闭的，则不执行任何操作
      if (!siteSettings.lottery_enabled) {
        return;
      }

      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",

        showLotteryForm() {
          const allowedCategoriesSetting = siteSettings.lottery_allowed_categories || "";
          const allowedCategories = allowedCategoriesSetting.split('|').map(Number).filter(id => id > 0);
          const currentCategoryId = this.get('model.categoryId');

          // 逻辑不变：必须是新建主题，且当前分类在允许列表中
          return this.get('model.action') === 'createTopic' && 
                 allowedCategories.length > 0 && 
                 allowedCategories.includes(currentCategoryId);
        },
        
        minParticipantsError: null,
        backupStrategyOptions: [
          { id: 'continue', name: I18n.t('lottery.form.backup_strategy.options.continue') },
          { id: 'cancel', name: I18n.t('lottery.form.backup_strategy.options.cancel') }
        ],
        actions: {
          validateMinParticipants() {
            const minParticipants = this.get("model.lotteryMinParticipants");
            if (minParticipants && parseInt(minParticipants, 10) < siteSettings.lottery_min_participants_global) {
              this.set("minParticipantsError", I18n.t('lottery.form.min_participants.error', { count: siteSettings.lottery_min_participants_global }));
            } else {
              this.set("minParticipantsError", null);
            }
          }
        },
        _gatherLotteryData() {
            const data = {};
            data.prize_name = this.get("model.lotteryPrizeName");
            data.prize_details = this.get("model.lotteryPrizeDetails");
            data.draw_time = this.get("model.lotteryDrawTime");
            data.winners_count = this.get("model.lotteryWinnersCount");
            data.specified_post_numbers = this.get("model.lotterySpecifiedPosts");
            data.min_participants = this.get("model.lotteryMinParticipants");
            data.backup_strategy = this.get("model.lotteryBackupStrategy") || 'continue';
            return Object.fromEntries(Object.entries(data).filter(([_, v]) => v != null && v !== ''));
        },
        save(options) {
            if (this.showLotteryForm()) {
                const lotteryData = this._gatherLotteryData();
                if (Object.keys(lotteryData).length > 0) {
                    this.get("model").set("custom_fields.lottery", JSON.stringify(lotteryData));
                }
            }
            return this._super(options);
        }
      });
    });
  },
};

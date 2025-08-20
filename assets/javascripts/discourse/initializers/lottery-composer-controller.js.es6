// file: discourse-lottery-v3/assets/javascripts/discourse/initializers/lottery-composer-controller.js.es6

import { withPluginApi } from "discourse/lib/plugin-api";
import I18n from "discourse-i18n";

export default {
  name: "lottery-composer-controller",
  initialize(container) {
    // 从 container 中获取 siteSettings 服务，这是更现代的做法
    const siteSettings = container.lookup("service:site-settings");
    
    // 如果插件总开关是关闭的，则不执行任何操作
    if (!siteSettings.lottery_enabled) {
      return;
    }

    withPluginApi("1.0.0", (api) => {
      api.modifyClass("controller:composer", {
        pluginId: "DiscourseLotteryV3",

        // 这是我们最终的、正确的显示逻辑
        showLotteryForm() {
          const allowedCategories = siteSettings.lottery_allowed_categories.split('|').map(Number);
          const currentCategoryId = this.get('model.categoryId');

          // 必须是新建主题，且当前分类在允许列表中
          return this.get('model.action') === 'createTopic' && allowedCategories.includes(currentCategoryId);
        },
        
        // ... (其余代码与之前最终版相同) ...
        minParticipantsError: null,
        backupStrategyOptions: [
          { id: 'continue', name: I18n.t('lottery.form.backup_strategy.options.continue') },
          { id: 'cancel', name: I18n.t('lottery.form.backup_strategy.options.cancel') }
        ],
        actions: { /* ... */ },
        _gatherLotteryData() { /* ... */ },
        save(options) { /* ... */ }
      });

      // 为了避免命名冲突，我们只复制必要的部分
      const composerController = api.container.lookup("controller:composer");
      if (composerController) {
          composerController.reopen({
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
      }
    });
  },
};

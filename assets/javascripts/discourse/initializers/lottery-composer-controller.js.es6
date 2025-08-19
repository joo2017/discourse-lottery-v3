// file: discourse-lottery-v3/assets/javascripts/discourse/initializers/lottery-composer-controller.js.es6

import { withPluginApi } from "discourse/lib/plugin-api";
import { I18n } from "discourse-i18n";

export default {
  name: "lottery-composer-controller",

  initialize() {
    withPluginApi("1.0.0", (api) => {
      // 使用 api.modifyClass 来扩展 Composer Controller 的功能，这是标准做法
      api.modifyClass("controller:composer", {
        pluginId: "DiscourseLotteryV3", // 方便调试，标识这些修改来自哪个插件

        // 我们将在模板中通过 controller.showLotteryForm 来判断是否显示表单
        // TODO: 未来这里可以加入逻辑，比如只在特定分类下才返回 true
        showLotteryForm: true, 

        // 用于存储“参与门槛”的错误信息
        minParticipantsError: null,

        // 为“后备策略”的下拉框提供选项
        backupStrategyOptions: [
          { id: 'continue', name: I18n.t('lottery.form.backup_strategy.options.continue') },
          { id: 'cancel', name: I18n.t('lottery.form.backup_strategy.options.cancel') }
        ],

        actions: {
          // 这个 action 对应模板中 `change=(action "validateMinParticipants")`
          validateMinParticipants() {
            const minParticipants = this.get("model.lotteryMinParticipants");
            const globalMin = api.container.lookup("site-settings:main").lottery_min_participants_global;

            if (minParticipants && parseInt(minParticipants, 10) < globalMin) {
              this.set("minParticipantsError", I18n.t('lottery.form.min_participants.error', { count: globalMin }));
            } else {
              this.set("minParticipantsError", null); // 清除错误信息
            }
          },
        },

        // 收集所有表单数据到一个对象中
        _gatherLotteryData() {
          const data = {};
          data.prize_name = this.get("model.lotteryPrizeName");
          data.prize_details = this.get("model.lotteryPrizeDetails");
          data.draw_time = this.get("model.lotteryDrawTime");
          data.winners_count = this.get("model.lotteryWinnersCount");
          data.specified_post_numbers = this.get("model.lotterySpecifiedPosts");
          data.min_participants = this.get("model.lotteryMinParticipants");
          // 如果用户没选，给一个默认值
          data.backup_strategy = this.get("model.lotteryBackupStrategy") || 'continue'; 
          
          // 过滤掉所有值为空的字段
          return Object.fromEntries(Object.entries(data).filter(([_, v]) => v != null && v !== ''));
        },

        // 重写核心的 save 方法
        save(options) {
          if (this.showLotteryForm) {
            const lotteryData = this._gatherLotteryData();
            // 将抽奖数据存入 custom_fields，这是插件与后端通信的关键
            this.get("model").set("custom_fields.lottery", lotteryData);
          }
          // 调用原始的 save 方法，确保正常发帖
          return this._super(options);
        }
      });
    });
  },
};

import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";

export default class LotterySettingsModal extends Component {
  @service siteSettings;
  @service modal;

  @tracked prizeName = "";
  @tracked prizeDetails = "";
  @tracked drawTime = "";
  @tracked winnersCount = 1;
  @tracked specifiedPosts = "";
  @tracked minParticipants = 10;
  @tracked backupStrategy = "continue";
  @tracked additionalNotes = "";
  @tracked errors = {};

  constructor() {
    super(...arguments);
    this.minParticipants = this.siteSettings.lottery_min_participants_global || 10;
    console.log("🎲 LotterySettingsModal initialized");
  }

  get globalMinParticipants() {
    return this.siteSettings.lottery_min_participants_global || 10;
  }

  get isFormValid() {
    return (
      this.prizeName.trim().length > 0 &&
      this.prizeDetails.trim().length > 0 &&
      this.drawTime.length > 0 &&
      this.winnersCount > 0 &&
      this.minParticipants >= this.globalMinParticipants
    );
  }

  @action
  updatePrizeName(event) {
    this.prizeName = event.target.value;
  }

  @action
  updatePrizeDetails(event) {
    this.prizeDetails = event.target.value;
  }

  @action
  updateDrawTime(event) {
    this.drawTime = event.target.value;
  }

  @action
  updateWinnersCount(event) {
    this.winnersCount = parseInt(event.target.value) || 1;
  }

  @action
  updateSpecifiedPosts(event) {
    this.specifiedPosts = event.target.value;
  }

  @action
  updateMinParticipants(event) {
    this.minParticipants = parseInt(event.target.value) || 1;
  }

  @action
  updateBackupStrategy(event) {
    this.backupStrategy = event.target.value;
  }

  @action
  updateAdditionalNotes(event) {
    this.additionalNotes = event.target.value;
  }

  @action
  confirmLottery() {
    if (!this.isFormValid) {
      console.log("🎲 Form validation failed");
      return;
    }

    console.log("🎲 Creating lottery");

    const lotteryData = {
      prize_name: this.prizeName,
      prize_details: this.prizeDetails,
      draw_time: this.drawTime,
      winners_count: this.winnersCount,
      specified_posts: this.specifiedPosts,
      min_participants: this.minParticipants,
      backup_strategy: this.backupStrategy,
      additional_notes: this.additionalNotes
    };

    // 保存到全局变量
    window.lotteryFormDataCache = lotteryData;

    // 获取 composer 并插入内容
    const composer = this.args.model.composer;
    if (composer) {
      const placeholder = `\n\n[lottery]\n活动名称: ${this.prizeName}\n奖品说明: ${this.prizeDetails}\n开奖时间: ${this.drawTime}\n获奖人数: ${this.winnersCount}\n参与门槛: ${this.minParticipants}人\n[/lottery]\n\n`;
      const currentText = composer.get("model.reply") || "";
      composer.set("model.reply", currentText + placeholder);
    }

    console.log("🎲 Lottery data saved and inserted");

    // 关闭模态框
    this.modal.close();
  }

  @action
  cancelLottery() {
    this.modal.close();
  }
}

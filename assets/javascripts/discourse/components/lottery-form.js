import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";

export default class LotteryForm extends Component {
  @service siteSettings;
  
  // 表单数据
  @tracked prizeName = "";
  @tracked prizeDetails = "";
  @tracked drawTime = "";
  @tracked winnersCount = 1;
  @tracked specifiedPosts = "";
  @tracked minParticipants = 5;
  @tracked backupStrategy = "continue";
  @tracked additionalNotes = "";

  // 错误状态
  @tracked errors = {};

  constructor() {
    super(...arguments);
    // 初始化最小参与人数
    this.minParticipants = this.siteSettings.lottery_min_participants_global || 5;
  }

  // 获取全局最小参与人数
  get globalMinParticipants() {
    return this.siteSettings.lottery_min_participants_global || 5;
  }

  // 检查表单是否有效
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

  // 获取表单数据
  get formData() {
    return {
      prize_name: this.prizeName,
      prize_details: this.prizeDetails,
      draw_time: this.drawTime,
      winners_count: this.winnersCount,
      specified_posts: this.specifiedPosts,
      min_participants: this.minParticipants,
      backup_strategy: this.backupStrategy,
      additional_notes: this.additionalNotes
    };
  }
}

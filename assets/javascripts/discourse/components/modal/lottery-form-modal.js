import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";

export default class LotteryFormModal extends Component {
  @service siteSettings;

  @tracked prizeName = "";
  @tracked prizeDetails = "";
  @tracked drawTime = "";
  @tracked winnersCount = 1;
  @tracked specifiedPosts = "";
  @tracked minParticipants = this.siteSettings.lottery_min_participants_global || 5;
  @tracked backupStrategy = "continue";
  @tracked additionalNotes = "";

  get isValid() {
    return (
      this.prizeName.trim() &&
      this.prizeDetails.trim() &&
      this.drawTime.trim() &&
      this.minParticipants >= this.siteSettings.lottery_min_participants_global
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
    const num = parseInt(event.target.value) || 0;
    this.minParticipants = Math.max(num, this.siteSettings.lottery_min_participants_global);
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
  insert() {
    if (!this.isValid) {
      alert("请填写所有必填字段");
      return;
    }

    // 验证时间格式
    try {
      const drawDate = new Date(this.drawTime);
      if (isNaN(drawDate.getTime()) || drawDate <= new Date()) {
        alert("开奖时间格式无效或不能是过去时间");
        return;
      }
    } catch (e) {
      alert("开奖时间格式无效");
      return;
    }

    const lotteryData = {
      prize_name: this.prizeName.trim(),
      prize_details: this.prizeDetails.trim(),
      draw_time: this.drawTime.trim(),
      winners_count: this.winnersCount,
      specified_posts: this.specifiedPosts.trim(),
      min_participants: this.minParticipants,
      backup_strategy: this.backupStrategy,
      additional_notes: this.additionalNotes.trim()
    };

    console.log("🎲 Lottery form data:", lotteryData);

    // 调用传入的回调函数
    if (this.args.model?.insertLotteryContent) {
      this.args.model.insertLotteryContent(lotteryData);
    }

    // 关闭模态
    this.args.closeModal();
  }

  @action
  cancel() {
    this.args.closeModal();
  }
}

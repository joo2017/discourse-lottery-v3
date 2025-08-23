import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";

export default class LotteryFormModal extends Component {
  @service composer;
  @service modal;
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
  updatePrizeName(value) {
    this.prizeName = value;
  }

  @action
  updatePrizeDetails(value) {
    this.prizeDetails = value;
  }

  @action
  updateDrawTime(value) {
    this.drawTime = value;
  }

  @action
  updateWinnersCount(value) {
    this.winnersCount = parseInt(value) || 1;
  }

  @action
  updateSpecifiedPosts(value) {
    this.specifiedPosts = value;
  }

  @action
  updateMinParticipants(value) {
    const num = parseInt(value) || 0;
    this.minParticipants = Math.max(num, this.siteSettings.lottery_min_participants_global);
  }

  @action
  updateBackupStrategy(value) {
    this.backupStrategy = value;
  }

  @action
  updateAdditionalNotes(value) {
    this.additionalNotes = value;
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

    // 调用 composer 的 action 来插入内容
    const composer = this.composer;
    if (composer && composer.send) {
      composer.send("insertLotteryContent", lotteryData);
    }

    // 关闭模态
    this.modal.close();
  }

  @action
  cancel() {
    this.modal.close();
  }
}

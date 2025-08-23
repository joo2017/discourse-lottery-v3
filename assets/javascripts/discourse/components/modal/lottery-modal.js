import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";

export default class LotteryModal extends Component {
  @service siteSettings;
  
  @tracked prizeName = "";
  @tracked prizeDetails = "";
  @tracked drawTime = "";
  @tracked winnersCount = 1;
  @tracked specifiedPosts = "";
  @tracked minParticipants = this.siteSettings.lottery_min_participants_global || 5;
  @tracked backupStrategy = "continue";
  @tracked additionalNotes = "";
  @tracked errors = {};

  get isValid() {
    return (
      this.prizeName.trim() &&
      this.prizeDetails.trim() &&
      this.drawTime.trim() &&
      this.minParticipants >= (this.siteSettings.lottery_min_participants_global || 5)
    );
  }

  get lotteryType() {
    return this.specifiedPosts.trim() ? "指定楼层" : "随机抽取";
  }

  @action
  updatePrizeName(event) {
    this.prizeName = event.target.value;
    if (this.errors.prizeName) delete this.errors.prizeName;
  }

  @action
  updatePrizeDetails(event) {
    this.prizeDetails = event.target.value;
    if (this.errors.prizeDetails) delete this.errors.prizeDetails;
  }

  @action
  updateDrawTime(event) {
    this.drawTime = event.target.value;
    if (this.errors.drawTime) delete this.errors.drawTime;
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
    if (this.errors.minParticipants) delete this.errors.minParticipants;
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
  validateAndSubmit() {
    this.errors = {};

    // 验证必填字段
    if (!this.prizeName.trim()) {
      this.errors.prizeName = "活动名称不能为空";
    }
    if (!this.prizeDetails.trim()) {
      this.errors.prizeDetails = "奖品说明不能为空";
    }
    if (!this.drawTime.trim()) {
      this.errors.drawTime = "开奖时间不能为空";
    }

    // 验证时间格式
    if (this.drawTime.trim()) {
      try {
        const testDate = new Date(this.drawTime);
        if (isNaN(testDate.getTime()) || testDate <= new Date()) {
          this.errors.drawTime = "开奖时间无效或不能是过去时间";
        }
      } catch (e) {
        this.errors.drawTime = "时间格式无效，请使用 YYYY-MM-DDTHH:MM 格式";
      }
    }

    // 验证最小参与人数
    const globalMin = this.siteSettings.lottery_min_participants_global || 5;
    if (this.minParticipants < globalMin) {
      this.errors.minParticipants = `参与门槛不能低于${globalMin}人`;
    }

    // 如果有错误，不提交
    if (Object.keys(this.errors).length > 0) {
      return;
    }

    // 创建抽奖数据
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

    console.log("🎲 Lottery form submitted with data:", lotteryData);

    // 调用回调函数
    if (this.args.model?.onSubmit) {
      this.args.model.onSubmit(lotteryData);
    }

    // 关闭模态框
    this.args.closeModal();
  }
}

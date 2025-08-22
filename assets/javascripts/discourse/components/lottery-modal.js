import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";

export default class LotteryModal extends Component {
  @service siteSettings;
  @service appEvents;
  
  // 表单数据
  @tracked prizeName = "";
  @tracked prizeDetails = "";
  @tracked drawTime = "";
  @tracked winnersCount = 1;
  @tracked specifiedPosts = "";
  @tracked minParticipants = 5;
  @tracked backupStrategy = "continue";
  @tracked additionalNotes = "";

  constructor() {
    super(...arguments);
    // 初始化最小参与人数
    this.minParticipants = this.siteSettings.lottery_min_participants_global || 5;
    console.log("🎲 Lottery modal initialized");
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
    console.log("🎲 Prize name updated:", this.prizeName);
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
  insertLottery() {
    if (!this.isFormValid) {
      console.log("🎲 Form is invalid, not inserting");
      return;
    }

    console.log("🎲 Inserting lottery into composer");
    
    // 构建抽奖数据
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

    console.log("🎲 Lottery data:", lotteryData);

    // 保存到全局变量，供发布时使用
    window.lotteryFormDataCache = lotteryData;

    // 在编辑器中插入抽奖占位符
    const placeholder = `\n\n[lottery]\n活动名称：${this.prizeName}\n奖品说明：${this.prizeDetails}\n开奖时间：${this.drawTime}\n[/lottery]\n\n`;
    
    // 使用 appEvents 通知 composer 插入内容
    this.appEvents.trigger("composer:insert-text", placeholder);

    console.log("🎲 Triggered composer insert text event");

    // 关闭模态框
    this.args.closeModal();
  }

  @action
  closeModal() {
    this.args.closeModal();
  }
}

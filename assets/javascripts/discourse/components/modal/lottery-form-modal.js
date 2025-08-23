import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";

export default class LotteryFormModal extends Component {
  // 表单数据（使用 @tracked 进行响应式更新）
  @tracked prizeName = "";
  @tracked prizeDetails = "";
  @tracked drawTime = "";
  @tracked winnersCount = 1;
  @tracked specifiedPosts = "";
  @tracked minParticipants = 5;
  @tracked backupStrategy = "continue";
  @tracked additionalNotes = "";
  
  // 状态管理
  @tracked isLoading = false;
  @tracked flash = "";
  @tracked flashType = "";

  constructor(owner, args) {
    super(owner, args);
    // 初始化最小参与人数
    this.minParticipants = this.args.model?.siteSettings?.lottery_min_participants_global || 5;
    console.log("🎲 抽奖表单模态框已创建");
  }

  // 验证表单是否有效
  get isValid() {
    const hasRequiredFields = this.prizeName.trim() && 
                             this.prizeDetails.trim() && 
                             this.drawTime.trim();
    const hasValidMinParticipants = this.minParticipants >= (this.args.model?.siteSettings?.lottery_min_participants_global || 5);
    
    return hasRequiredFields && hasValidMinParticipants;
  }

  // 获取全局最小参与人数
  get globalMinParticipants() {
    return this.args.model?.siteSettings?.lottery_min_participants_global || 5;
  }

  // 更新活动名称
  @action
  updatePrizeName(event) {
    this.prizeName = event.target.value;
    this.clearFlash();
  }

  // 更新奖品说明
  @action
  updatePrizeDetails(event) {
    this.prizeDetails = event.target.value;
    this.clearFlash();
  }

  // 更新开奖时间
  @action
  updateDrawTime(event) {
    this.drawTime = event.target.value;
    this.clearFlash();
  }

  // 更新获奖人数
  @action
  updateWinnersCount(event) {
    this.winnersCount = parseInt(event.target.value) || 1;
  }

  // 更新指定楼层
  @action
  updateSpecifiedPosts(event) {
    this.specifiedPosts = event.target.value;
  }

  // 更新参与门槛
  @action
  updateMinParticipants(event) {
    const num = parseInt(event.target.value) || 0;
    this.minParticipants = Math.max(num, this.globalMinParticipants);
  }

  // 更新后备策略
  @action
  updateBackupStrategy(event) {
    this.backupStrategy = event.target.value;
  }

  // 更新补充说明
  @action
  updateAdditionalNotes(event) {
    this.additionalNotes = event.target.value;
  }

  // 清除错误提示
  @action
  clearFlash() {
    this.flash = "";
    this.flashType = "";
  }

  // 显示错误提示
  @action
  showFlash(message, type = "error") {
    this.flash = message;
    this.flashType = type;
  }

  // 提交表单
  @action
  async submit() {
    console.log("🎲 正在提交抽奖表单");

    if (!this.isValid) {
      this.showFlash("请填写所有必填字段");
      return;
    }

    // 验证时间格式和有效性
    try {
      const drawDate = new Date(this.drawTime);
      if (isNaN(drawDate.getTime())) {
        this.showFlash("开奖时间格式无效");
        return;
      }
      if (drawDate <= new Date()) {
        this.showFlash("开奖时间必须是未来时间");
        return;
      }
    } catch (e) {
      this.showFlash("开奖时间格式无效");
      return;
    }

    // 验证参与门槛
    if (this.minParticipants < this.globalMinParticipants) {
      this.showFlash(`参与门槛不能低于全局设置的 ${this.globalMinParticipants} 人`);
      return;
    }

    this.isLoading = true;

    try {
      // 构建抽奖数据
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

      console.log("🎲 抽奖表单数据:", lotteryData);

      // 调用传入的回调函数插入内容
      if (this.args.model?.insertLotteryContent) {
        this.args.model.insertLotteryContent(lotteryData);
      }

      // 显示成功提示
      this.showFlash("抽奖信息已插入编辑器", "success");
      
      // 延迟关闭模态框，让用户看到成功提示
      setTimeout(() => {
        this.args.closeModal();
      }, 1000);

    } catch (error) {
      console.error("🎲 提交抽奖表单时出错:", error);
      this.showFlash("提交失败：" + error.message);
    } finally {
      this.isLoading = false;
    }
  }

  // 取消操作
  @action
  cancel() {
    console.log("🎲 用户取消了抽奖表单");
    this.args.closeModal();
  }
}

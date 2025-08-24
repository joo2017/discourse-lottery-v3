// 在您的 lottery-form-modal.js 的 submit 方法中，替换这部分：

// 找到这段代码：
// window.lotteryFormDataCache = lotteryData;
// console.log("🎲 数据已缓存到 window.lotteryFormDataCache");

// 替换为：
console.log("🎲 构建的抽奖数据对象:", lotteryData);

// 官方推荐：直接设置到 composer.customFields
if (window.setLotteryToComposer) {
  const success = window.setLotteryToComposer(lotteryData);
  
  if (success) {
    console.log("🎲 ✅ 成功设置抽奖数据到 composer");
    
    // 显示成功消息
    this.showFlash("抽奖信息已设置", "success");
    
    // 延迟关闭模态框
    setTimeout(() => {
      console.log("🎲 关闭模态框");
      this.args.closeModal();
    }, 1500);
  } else {
    console.error("🎲 ❌ 设置抽奖数据失败");
    this.showFlash("设置失败，请重试");
  }
} else {
  console.error("🎲 ❌ setLotteryToComposer 方法不可用");
  this.showFlash("系统错误，请刷新页面重试");
}

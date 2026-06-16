function Avatar({ user, size = 40 }) {
  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt=""
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center font-medium flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: "rgba(255,255,255,0.25)",
        border: "2px solid rgba(255,255,255,0.5)",
        color: "white",
        fontSize: Math.round(size * 0.33),
      }}
    >
      {user?.username?.slice(0, 2).toUpperCase()}
    </div>
  );
}

export default Avatar;

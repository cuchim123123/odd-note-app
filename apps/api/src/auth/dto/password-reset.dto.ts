export type ForgotPasswordDto = {
	email: string;
};

export type ResetPasswordDto = {
	token: string;
	password: string;
	confirmPassword: string;
};

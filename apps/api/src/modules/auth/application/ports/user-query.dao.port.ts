export const USER_QUERY_DAO = Symbol('USER_QUERY_DAO');

export interface UserView {
  id: string;
  email: string;
  displayName: string;
  isEmailVerified: boolean;
  avatarUrl: string | null;
}

export interface IUserQueryDao {
  findById(userId: string): Promise<UserView | null>;
}
